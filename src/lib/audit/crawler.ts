import { UnsafeUrlError, assertPublicHost, parseAndValidateUrlShape } from "./urlSafety";

const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 10_000;
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
 * Fetches a page manually (redirect: "manual") so every hop can be re-validated
 * against the SSRF guard before being followed — `fetch`'s built-in redirect
 * follower would happily chase a redirect straight into a private address.
 */
export async function fetchPageSafely(rawUrl: string): Promise<FetchedPage> {
  let current = parseAndValidateUrlShape(rawUrl);
  await assertPublicHost(current.hostname);

  const start = Date.now();

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(current.toString(), {
        redirect: "manual",
        signal: controller.signal,
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
      const validated = parseAndValidateUrlShape(next.toString());
      await assertPublicHost(validated.hostname);
      current = validated;
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
