export type DomainAuthorityResult = {
  domain: string;
  pageRankDecimal: number | null; // 0-10 scale
  rank: number | null; // global rank among domains OPR tracks; lower is better
  error?: string;
};

/**
 * OpenPageRank computes a free 0-10 authority-style score from Common
 * Crawl's open web graph — the one legitimate free alternative to
 * Moz/Ahrefs' paid Domain Authority metrics. Free tier: 30,000 domains/month,
 * up to 100 domains per request (we only ever send one).
 *
 * The service has since been folded into Keywords Everywhere and now lives
 * at openpagerank.keywordseverywhere.com with an entirely new API: a POST
 * to /v1/domains/bulk with a Bearer token, not the legacy GET + API-OPR
 * header scheme the original openpagerank.com API used.
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch("https://openpagerank.keywordseverywhere.com/v1/domains/bulk", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ domains: [domain], include_history: false }),
    });
    if (!res.ok) {
      return { domain, pageRankDecimal: null, rank: null, error: `OpenPageRank API returned ${res.status}` };
    }
    const data = await res.json();
    const result = data?.results?.[0];
    if (!result || result.found !== true) {
      return { domain, pageRankDecimal: null, rank: null, error: "No ranking data for this domain." };
    }

    return {
      domain,
      pageRankDecimal: typeof result.open_page_rank === "number" ? result.open_page_rank : null,
      rank: typeof result.rank === "number" ? result.rank : null,
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
