export type PerformanceOpportunity = {
  id: string;
  title: string;
  description: string;
  displayValue?: string;
  savingsMs?: number;
};

export type PageSpeedResult = {
  performanceScore: number | null;
  seoScore: number | null;
  accessibilityScore: number | null;
  isMobileFriendly: boolean | null;
  opportunities: PerformanceOpportunity[];
  error?: string;
};

/**
 * Lighthouse returns a huge `audits` map keyed by audit id. We only want the
 * ones that actually failed/need work (score < 0.9, or no numeric score but
 * flagged not-applicable-passed), sorted so the biggest real wins come first.
 * This is data the API already returns that the rest of the app was
 * discarding after only reading the category totals.
 */
function extractOpportunities(audits: Record<string, unknown> | undefined): PerformanceOpportunity[] {
  if (!audits || typeof audits !== "object") return [];

  type RawAudit = {
    id?: string;
    title?: string;
    description?: string;
    score?: number | null;
    scoreDisplayMode?: string;
    displayValue?: string;
    details?: { overallSavingsMs?: number };
  };

  const candidates = Object.values(audits as Record<string, RawAudit>).filter((a): a is RawAudit => {
    if (!a || typeof a !== "object") return false;
    if (a.scoreDisplayMode === "notApplicable" || a.scoreDisplayMode === "informative") return false;
    return typeof a.score === "number" && a.score < 0.9;
  });

  candidates.sort((a, b) => (b.details?.overallSavingsMs ?? 0) - (a.details?.overallSavingsMs ?? 0));

  return candidates.slice(0, 8).map((a) => ({
    id: a.id ?? "",
    title: a.title ?? "",
    // Lighthouse descriptions include markdown-style links like
    // [text](url) and a trailing "[Learn more](...)" — strip both since
    // this text is about to be shown as plain text and fed to an LLM prompt.
    description: (a.description ?? "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim(),
    displayValue: a.displayValue,
    savingsMs: a.details?.overallSavingsMs,
  }));
}

/**
 * Calls Google's PageSpeed Insights API (free, API-key gated, generous quota).
 * Best-effort: if the key is missing or the call fails, the rest of the audit
 * should still work, so this returns nulls instead of throwing.
 */
export async function getPageSpeedResult(pageUrl: string): Promise<PageSpeedResult> {
  const apiKey = process.env.PAGESPEED_API_KEY;
  if (!apiKey) {
    return { performanceScore: null, seoScore: null, accessibilityScore: null, isMobileFriendly: null, opportunities: [], error: "PageSpeed API key not configured." };
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
      return { performanceScore: null, seoScore: null, accessibilityScore: null, isMobileFriendly: null, opportunities: [], error: `PageSpeed API returned ${res.status}` };
    }
    const data = await res.json();
    const categories = data?.lighthouseResult?.categories;
    const toScore = (v: unknown) => (typeof v === "number" ? Math.round(v * 100) : null);

    return {
      performanceScore: toScore(categories?.performance?.score),
      seoScore: toScore(categories?.seo?.score),
      accessibilityScore: toScore(categories?.accessibility?.score),
      isMobileFriendly: toScore(categories?.performance?.score) !== null,
      opportunities: extractOpportunities(data?.lighthouseResult?.audits),
    };
  } catch (err) {
    return {
      performanceScore: null,
      seoScore: null,
      accessibilityScore: null,
      isMobileFriendly: null,
      opportunities: [],
      error: err instanceof Error ? err.message : "PageSpeed request failed.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
