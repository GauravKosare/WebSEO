import { fetch as undiciFetch } from "undici";
import { parseAndValidateUrlShape, resolvePublicHost } from "./urlSafety";
import { pinnedAgent } from "./crawler";

const MAX_REDIRECTS = 5;
const PER_REQUEST_TIMEOUT_MS = 6_000;
const USER_AGENT = "WebSEO-Bot/1.0 (+https://github.com/GauravKosare/WebSEO)";
const LONG_REDIRECT_CHAIN = 3;
const CONCURRENCY = 6;

export type LinkStatus = "ok" | "redirect" | "broken" | "error";

export type LinkCheckEntry = {
  url: string;
  status: LinkStatus;
  statusCode: number | null;
  redirectCount: number;
  finalUrl: string | null;
};

/**
 * Checks one link's HTTP status without downloading its body — we only need
 * the status code and redirect chain length, so the body is cancelled as
 * soon as headers arrive instead of being read like fetchPageSafely does.
 * Same SSRF guard (per-hop DNS re-validation + IP pinning) as the main crawl.
 */
async function checkOneLink(rawUrl: string): Promise<LinkCheckEntry> {
  let current: URL;
  try {
    current = parseAndValidateUrlShape(rawUrl);
  } catch {
    return { url: rawUrl, status: "error", statusCode: null, redirectCount: 0, finalUrl: null };
  }

  let redirectCount = 0;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let addresses;
    try {
      addresses = await resolvePublicHost(current.hostname);
    } catch {
      return { url: rawUrl, status: "error", statusCode: null, redirectCount, finalUrl: current.toString() };
    }
    const chosen = addresses.find((a) => a.family === 4) ?? addresses[0];
    const agent = pinnedAgent(chosen.address, chosen.family);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PER_REQUEST_TIMEOUT_MS);

    let response: Awaited<ReturnType<typeof undiciFetch>>;
    try {
      response = await undiciFetch(current.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        dispatcher: agent,
        headers: { "User-Agent": USER_AGENT },
      });
    } catch {
      clearTimeout(timeout);
      return { url: rawUrl, status: "error", statusCode: null, redirectCount, finalUrl: current.toString() };
    }
    clearTimeout(timeout);
    // We only need the status/headers, not the body — cancel the stream so
    // the connection can close without downloading the full response.
    response.body?.cancel().catch(() => {});

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        return { url: rawUrl, status: "broken", statusCode: response.status, redirectCount, finalUrl: current.toString() };
      }
      redirectCount++;
      try {
        const next = new URL(location, current);
        next.username = "";
        next.password = "";
        current = parseAndValidateUrlShape(next.toString());
      } catch {
        return { url: rawUrl, status: "broken", statusCode: response.status, redirectCount, finalUrl: current.toString() };
      }
      continue;
    }

    const status: LinkStatus = response.status >= 400 ? "broken" : redirectCount >= LONG_REDIRECT_CHAIN ? "redirect" : redirectCount > 0 ? "redirect" : "ok";
    return { url: rawUrl, status, statusCode: response.status, redirectCount, finalUrl: current.toString() };
  }

  return { url: rawUrl, status: "broken", statusCode: null, redirectCount, finalUrl: current.toString() };
}

/** Bounded-concurrency link check so a batch of 20 links doesn't run fully sequential (slow) or fully parallel (resource spike). */
export async function checkLinks(urls: string[]): Promise<LinkCheckEntry[]> {
  const results: LinkCheckEntry[] = new Array(urls.length);
  let next = 0;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= urls.length) return;
      results[i] = await checkOneLink(urls[i]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker));
  return results;
}
