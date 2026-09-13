export type SafeBrowsingResult = {
  isFlagged: boolean;
  threatTypes: string[];
  checked: boolean;
  error?: string;
};

/**
 * Google Safe Browsing v4 Lookup API — free up to 100k queries/day, and
 * reuses the same Google Cloud project/API key as PAGESPEED_API_KEY (just
 * enable "Safe Browsing API" on that project, no separate key needed).
 *
 * Note for future maintenance: Google is sunsetting the v4 Lookup API on
 * 2027-03-31 in favor of v5, which uses a materially different (Oblivious
 * HTTP relay-based) protocol. Fine to rely on until then, not a "set once,
 * forget forever" integration.
 */
export async function checkSafeBrowsing(pageUrl: string): Promise<SafeBrowsingResult> {
  const apiKey = process.env.PAGESPEED_API_KEY;
  if (!apiKey) {
    return { isFlagged: false, threatTypes: [], checked: false, error: "No API key configured for Safe Browsing." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const res = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client: { clientId: "webseo", clientVersion: "1.0.0" },
        threatInfo: {
          threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [{ url: pageUrl }],
        },
      }),
    });

    if (!res.ok) {
      return { isFlagged: false, threatTypes: [], checked: false, error: `Safe Browsing API returned ${res.status}` };
    }

    const data = await res.json();
    const matches: { threatType?: string }[] = data?.matches ?? [];

    return {
      isFlagged: matches.length > 0,
      threatTypes: Array.from(new Set(matches.map((m) => m.threatType).filter((t): t is string => !!t))),
      checked: true,
    };
  } catch (err) {
    return { isFlagged: false, threatTypes: [], checked: false, error: err instanceof Error ? err.message : "Safe Browsing request failed." };
  } finally {
    clearTimeout(timeout);
  }
}
