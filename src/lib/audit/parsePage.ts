import * as cheerio from "cheerio";
import { computeReadability, type ReadabilityResult } from "./readability";

const MAX_LINKS_CAPTURED = 40;
const MAX_READABILITY_TEXT = 20_000;

export type ParsedPage = {
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  robotsMeta: string | null;
  lang: string | null;
  h1s: string[];
  h2Count: number;
  wordCount: number;
  images: { src: string | undefined; alt: string | undefined }[];
  internalLinks: number;
  externalLinks: number;
  internalLinkUrls: string[];
  hasViewportMeta: boolean;
  hasOpenGraph: boolean;
  hasStructuredData: boolean;
  readability: ReadabilityResult | null;
  textSample: string;
};

export function parsePage(html: string, pageUrl: string): ParsedPage {
  const $ = cheerio.load(html);
  const origin = new URL(pageUrl).origin;

  const title = $("head > title").first().text().trim() || null;
  const metaDescription = $('meta[name="description"]').attr("content")?.trim() || null;
  const canonical = $('link[rel="canonical"]').attr("href")?.trim() || null;
  const robotsMeta = $('meta[name="robots"]').attr("content")?.trim() || null;
  const lang = $("html").attr("lang")?.trim() || null;

  const h1s = $("h1")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);
  const h2Count = $("h2").length;

  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const wordCount = bodyText ? bodyText.split(" ").length : 0;

  const images = $("img")
    .map((_, el) => ({ src: $(el).attr("src"), alt: $(el).attr("alt") }))
    .get();

  let internalLinks = 0;
  let externalLinks = 0;
  const internalLinkUrls: string[] = [];
  const seenInternal = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    try {
      const resolved = new URL(href, pageUrl);
      resolved.hash = "";
      if (resolved.origin === origin) {
        internalLinks++;
        const normalized = resolved.toString();
        if (!seenInternal.has(normalized) && internalLinkUrls.length < MAX_LINKS_CAPTURED) {
          seenInternal.add(normalized);
          internalLinkUrls.push(normalized);
        }
      } else {
        externalLinks++;
      }
    } catch {
      // ignore unparsable hrefs
    }
  });

  const hasViewportMeta = $('meta[name="viewport"]').length > 0;
  const hasOpenGraph = $('meta[property^="og:"]').length > 0;
  const hasStructuredData = $('script[type="application/ld+json"]').length > 0;

  // Readability needs actual prose, not the full page body — nav links,
  // buttons, and other UI chrome have no sentence punctuation, which tanks a
  // Flesch score computed over raw body text (e.g. a run of nav labels reads
  // as one "sentence" with dozens of "words"). <p> tags are a reasonable
  // proxy for prose across most sites.
  const paragraphText = $("p")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const readability = computeReadability(paragraphText.slice(0, MAX_READABILITY_TEXT));

  return {
    title,
    metaDescription,
    canonical,
    robotsMeta,
    lang,
    h1s,
    h2Count,
    wordCount,
    images,
    internalLinks,
    externalLinks,
    internalLinkUrls,
    hasViewportMeta,
    hasOpenGraph,
    hasStructuredData,
    readability,
    textSample: bodyText.slice(0, 4000),
  };
}
