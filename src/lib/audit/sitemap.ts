import { fetch as undiciFetch } from "undici";
import { UnsafeUrlError, parseAndValidateUrlShape, resolvePublicHost } from "./urlSafety";
import { pinnedAgent } from "./crawler";
import { validateRobotsTxt, validateSitemapXml, type ValidationIssue } from "./sitemapValidation";

const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 8_000;
const MAX_BODY_BYTES = 2_000_000;
const USER_AGENT = "WebSEO-Bot/1.0 (+https://github.com/GauravKosare/WebSEO)";
const MAX_SITEMAP_URLS = 200; // just a discovery cap; the crawl route scans far fewer pages than this
const MAX_CHILD_SITEMAPS = 3;

/**
 * Fetches a URL as plain text (robots.txt, sitemap XML) rather than
 * requiring an HTML/XML content-type like fetchPageSafely does. Same SSRF
 * guard (per-hop DNS re-validation + IP pinning) as the rest of the crawler.
 */
async function fetchTextSafely(rawUrl: string): Promise<{ status: number; body: string; finalUrl: string } | null> {
  let current: URL;
  try {
    current = parseAndValidateUrlShape(rawUrl);
  } catch {
    return null;
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let addresses;
    try {
      addresses = await resolvePublicHost(current.hostname);
    } catch {
      return null;
    }
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
        headers: { "User-Agent": USER_AGENT },
      });
    } catch {
      clearTimeout(timeout);
      return null;
    }
    clearTimeout(timeout);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return null;
      try {
        const next = new URL(location, current);
        next.username = "";
        next.password = "";
        current = parseAndValidateUrlShape(next.toString());
      } catch {
        return null;
      }
      continue;
    }

    if (response.status >= 400) {
      response.body?.cancel().catch(() => {});
      return { status: response.status, body: "", finalUrl: current.toString() };
    }

    const reader = response.body?.getReader();
    let text = "";
    let bytes = 0;
    const decoder = new TextDecoder();
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_BODY_BYTES) {
          await reader.cancel().catch(() => {});
          break;
        }
        text += decoder.decode(value, { stream: true });
      }
    } else {
      text = await response.text();
    }

    return { status: response.status, body: text, finalUrl: current.toString() };
  }

  return null;
}

function extractLocs(xml: string): string[] {
  const matches = xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi);
  return Array.from(matches, (m) => m[1]);
}

function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex[\s>]/i.test(xml);
}

export type SitemapDiscoveryResult = {
  sitemapUrl: string | null;
  urls: string[];
  validationIssues: ValidationIssue[];
};

/**
 * Finds a site's sitemap (via robots.txt's Sitemap: directive, falling back
 * to the conventional /sitemap.xml path) and returns the page URLs it lists.
 * Handles one level of sitemap-index nesting (a sitemap that just lists other
 * sitemaps) since that's extremely common for larger sites.
 */
export async function discoverSitemapUrls(rootUrl: string): Promise<SitemapDiscoveryResult> {
  const root = parseAndValidateUrlShape(rootUrl);
  const origin = root.origin;

  let sitemapUrl: string | null = null;

  const robots = await fetchTextSafely(`${origin}/robots.txt`);
  if (robots && robots.status < 400) {
    const match = robots.body.match(/^\s*sitemap:\s*(\S+)/im);
    if (match) sitemapUrl = match[1];
  }

  if (!sitemapUrl) {
    sitemapUrl = `${origin}/sitemap.xml`;
  }

  const sitemapRes = await fetchTextSafely(sitemapUrl);
  if (!sitemapRes || sitemapRes.status >= 400 || !sitemapRes.body) {
    throw new UnsafeUrlError("Could not find a sitemap.xml for that site (checked robots.txt and /sitemap.xml).");
  }

  const robotsIssues = validateRobotsTxt(robots?.status ?? null, robots?.body ?? null, sitemapRes.finalUrl);

  let urls = extractLocs(sitemapRes.body);
  const topLevelLocs = urls;

  if (isSitemapIndex(sitemapRes.body)) {
    // Sitemap index: `urls` right now are child sitemap URLs, not pages.
    // Fetch a handful of the child sitemaps and collect their page URLs.
    const childSitemaps = urls.slice(0, MAX_CHILD_SITEMAPS);
    urls = [];
    for (const child of childSitemaps) {
      const childRes = await fetchTextSafely(child);
      if (childRes && childRes.status < 400 && childRes.body) {
        urls.push(...extractLocs(childRes.body));
      }
      if (urls.length >= MAX_SITEMAP_URLS) break;
    }
  }

  // Keep only same-origin page URLs, deduped, capped.
  const seen = new Set<string>();
  const pageUrls: string[] = [];
  for (const u of urls) {
    try {
      const parsed = new URL(u);
      if (parsed.origin !== origin) continue;
      const normalized = parsed.toString();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      pageUrls.push(normalized);
      if (pageUrls.length >= MAX_SITEMAP_URLS) break;
    } catch {
      // skip unparsable entries
    }
  }

  if (pageUrls.length === 0) {
    throw new UnsafeUrlError("That sitemap didn't list any pages we could scan.");
  }

  // Validated against the top-level sitemap's own <loc> entries — for a
  // sitemap index those are child sitemap URLs (also expected same-origin),
  // not the final page list, but that's still the right thing to validate.
  const sameOriginTopLevel = topLevelLocs.filter((u) => {
    try {
      return new URL(u).origin === origin;
    } catch {
      return false;
    }
  });
  const sitemapIssues = validateSitemapXml(sitemapRes.body, topLevelLocs, sameOriginTopLevel, origin);

  return {
    sitemapUrl: sitemapRes.finalUrl,
    urls: pageUrls,
    validationIssues: [...robotsIssues, ...sitemapIssues],
  };
}
