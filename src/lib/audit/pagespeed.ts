export type PageSpeedResult = {
  performanceScore: number | null;
  seoScore: number | null;
  accessibilityScore: number | null;
  isMobileFriendly: boolean | null;
  error?: string;
};

/**
 * Calls Google's PageSpeed Insights API (free, API-key gated, generous quota).
 * Best-effort: if the key is missing or the call fails, the rest of the audit
 * should still work, so this returns nulls instead of throwing.
 */
export async function getPageSpeedResult(pageUrl: string): Promise<PageSpeedResult> {
  const apiKey = process.env.PAGESPEED_API_KEY;
  if (!apiKey) {
    return { performanceScore: null, seoScore: null, accessibilityScore: null, isMobileFriendly: null, error: "PageSpeed API key not configured." };
  }

  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", pageUrl);
  endpoint.searchParams.set("key", apiKey);
  endpoint.searchParams.set("strategy", "mobile");
  for (const cat of ["performance", "seo", "accessibility"]) {
    endpoint.searchParams.append("category", cat);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const res = await fetch(endpoint.toString(), { signal: controller.signal });
    if (!res.ok) {
      return { performanceScore: null, seoScore: null, accessibilityScore: null, isMobileFriendly: null, error: `PageSpeed API returned ${res.status}` };
    }
    const data = await res.json();
    const categories = data?.lighthouseResult?.categories;
    const toScore = (v: unknown) => (typeof v === "number" ? Math.round(v * 100) : null);

    return {
      performanceScore: toScore(categories?.performance?.score),
      seoScore: toScore(categories?.seo?.score),
      accessibilityScore: toScore(categories?.accessibility?.score),
      isMobileFriendly: toScore(categories?.performance?.score) !== null,
    };
  } catch (err) {
    return {
      performanceScore: null,
      seoScore: null,
      accessibilityScore: null,
      isMobileFriendly: null,
      error: err instanceof Error ? err.message : "PageSpeed request failed.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
