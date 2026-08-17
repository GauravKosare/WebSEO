import { Agent, fetch as undiciFetch } from "undici";
import { UnsafeUrlError, parseAndValidateUrlShape, resolvePublicHost } from "./urlSafety";

const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 10_000;
const OVERALL_BUDGET_MS = 20_000; // keeps the whole crawl well inside our routes' maxDuration
const MAX_BODY_BYTES = 3_000_000; // 3MB cap so a huge page can't exhaust memory
const USER_AGENT = "WebSEO-Bot/1.0 (+https://github.com/GauravKosare/WebSEO)";

export type FetchedPage = {
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  html: string;
  fetchTimeMs: number;
};

/**
 * Builds an undici Agent whose connector is pinned to a single, already
 * SSRF-validated IP address. This closes the DNS-rebinding TOCTOU gap that a
 * plain "resolve, check, then let fetch resolve again" approach has: fetch
 * never gets to perform its own DNS lookup, so a hostname that answers
 * differently between our check and the actual connection can't matter.
 */
function pinnedAgent(address: string, family: 4 | 6): Agent {
  return new Agent({
    connect: {
      // Node's net module resolves via lookupAndConnectMultiple (Happy
      // Eyeballs) by default, which calls this with { all: true } and expects
      // an array of {address, family} back — not the single (address,
      // family) pair dns.lookup's plain callback form takes. Handle both so
      // this works regardless of which internal path net picks.
      lookup: (_hostname, optionsOrCallback, maybeCallback) => {
        const options = typeof optionsOrCallback === "function" ? undefined : optionsOrCallback;
        const callback = typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback;
        if (!callback) return;
        if (options && "all" in options && options.all) {
          callback(null, [{ address, family }]);
        } else {
          callback(null, address, family);
        }
      },
    },
  });
}

/**
 * Fetches a page manually (redirect: "manual") so every hop can be
 * re-validated against the SSRF guard — and re-pinned to a specific IP —
 * before being followed.
 */
export async function fetchPageSafely(rawUrl: string): Promise<FetchedPage> {
  let current = parseAndValidateUrlShape(rawUrl);
  const start = Date.now();

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (Date.now() - start > OVERALL_BUDGET_MS) {
      throw new UnsafeUrlError("The site took too long to respond.");
    }

    const addresses = await resolvePublicHost(current.hostname);
    // Prefer an IPv4 result for the pin when available; fall back to the first.
    const chosen = addresses.find((a) => a.family === 4) ?? addresses[0];
    const agent = pinnedAgent(chosen.address, chosen.family);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Awaited<ReturnType<typeof undiciFetch>>;
    try {
      response = await undiciFetch(current.toString(), {
        redirect: "manual",
        signal: controller.signal,
        dispatcher: agent,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
        },
      });
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === "AbortError") {
        throw new UnsafeUrlError("The site took too long to respond.");
      }
      throw new UnsafeUrlError("Could not reach that site.");
    }
    clearTimeout(timeout);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new UnsafeUrlError("Site returned a redirect with no destination.");
      }
      const next = new URL(location, current);
      next.username = "";
      next.password = "";
      current = parseAndValidateUrlShape(next.toString());
      continue;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("html") && !contentType.includes("xml")) {
      throw new UnsafeUrlError("That URL did not return an HTML page.");
    }

    const reader = response.body?.getReader();
    let html = "";
    let bytes = 0;
    const decoder = new TextDecoder();
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_BODY_BYTES) {
          await reader.cancel().catch(() => {});
          throw new UnsafeUrlError("That page is too large to analyze.");
        }
        html += decoder.decode(value, { stream: true });
      }
    } else {
      html = await response.text();
    }

    const headers: Record<string, string> = {};
    response.headers.forEach((v, k) => {
      headers[k] = v;
    });

    return {
      finalUrl: current.toString(),
      status: response.status,
      headers,
      html,
      fetchTimeMs: Date.now() - start,
    };
  }

  throw new UnsafeUrlError("Too many redirects.");
}
