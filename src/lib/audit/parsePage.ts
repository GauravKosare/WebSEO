import * as cheerio from "cheerio";

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
  hasViewportMeta: boolean;
  hasOpenGraph: boolean;
  hasStructuredData: boolean;
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
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    try {
      const resolved = new URL(href, pageUrl);
      if (resolved.origin === origin) internalLinks++;
      else externalLinks++;
    } catch {
      // ignore unparsable hrefs
    }
  });

  const hasViewportMeta = $('meta[name="viewport"]').length > 0;
  const hasOpenGraph = $('meta[property^="og:"]').length > 0;
  const hasStructuredData = $('script[type="application/ld+json"]').length > 0;

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
    hasViewportMeta,
    hasOpenGraph,
    hasStructuredData,
    textSample: bodyText.slice(0, 4000),
  };
}
