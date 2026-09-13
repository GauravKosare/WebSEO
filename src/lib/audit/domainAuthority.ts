export type DomainAuthorityResult = {
  domain: string;
  pageRankDecimal: number | null; // 0-10 scale
  rank: number | null; // global rank among domains OPR tracks; lower is better
  error?: string;
};

/**
 * OpenPageRank (domcop.com) computes a free 0-10 authority-style score from
 * Common Crawl's open web graph — the one legitimate free alternative to
 * Moz/Ahrefs' paid Domain Authority metrics. Free tier: 30,000 domains/month,
 * up to 100 domains per request (we only ever send one).
 */
export async function getDomainAuthority(pageUrl: string): Promise<DomainAuthorityResult> {
  let domain: string;
  try {
    domain = new URL(pageUrl).hostname;
  } catch {
    return { domain: pageUrl, pageRankDecimal: null, rank: null, error: "Invalid URL." };
  }

  const apiKey = process.env.OPENPAGERANK_API_KEY;
  if (!apiKey) {
    return { domain, pageRankDecimal: null, rank: null, error: "OpenPageRank API key not configured." };
  }

  const endpoint = new URL("https://openpagerank.com/api/v1.0/getPageRank");
  endpoint.searchParams.set("domains[0]", domain);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(endpoint.toString(), {
      headers: { "API-OPR": apiKey },
      signal: controller.signal,
    });
    if (!res.ok) {
      return { domain, pageRankDecimal: null, rank: null, error: `OpenPageRank API returned ${res.status}` };
    }
    const data = await res.json();
    const result = data?.response?.[0];
    if (!result || result.status_code !== 200) {
      return { domain, pageRankDecimal: null, rank: null, error: result?.error ?? "No ranking data for this domain." };
    }

    return {
      domain,
      pageRankDecimal: typeof result.page_rank_decimal === "number" ? result.page_rank_decimal : null,
      rank: typeof result.rank === "number" ? result.rank : (result.rank ? Number(result.rank) : null),
    };
  } catch (err) {
    return {
      domain,
      pageRankDecimal: null,
      rank: null,
      error: err instanceof Error ? err.message : "OpenPageRank request failed.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
