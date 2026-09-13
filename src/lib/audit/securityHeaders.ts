export type SecurityHeaderCheck = {
  header: string;
  present: boolean;
  note: string;
};

export type SecurityHeadersResult = {
  isHttps: boolean;
  checks: SecurityHeaderCheck[];
  grade: "good" | "fair" | "poor";
};

/**
 * Pure analysis of response headers we already captured during the crawl —
 * no extra request. Mirrors what tools like securityheaders.com check, at a
 * lighter weight: presence of the headers that actually matter for SEO/trust
 * (HSTS affects Google's HTTPS signal; a missing X-Frame-Options/CSP is a
 * real clickjacking/XSS risk that a security-literate visitor — or Google's
 * own crawler diagnostics — will notice).
 */
export function analyzeSecurityHeaders(headers: Record<string, string>, finalUrl: string): SecurityHeadersResult {
  // fetch()/undici normalizes header names to lowercase, but don't assume it.
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;

  const isHttps = finalUrl.startsWith("https://");

  const checks: SecurityHeaderCheck[] = [
    {
      header: "Strict-Transport-Security",
      present: !!lower["strict-transport-security"],
      note: "Tells browsers to always use HTTPS for this site, preventing downgrade attacks.",
    },
    {
      header: "X-Content-Type-Options",
      present: lower["x-content-type-options"]?.toLowerCase().includes("nosniff") ?? false,
      note: "Stops browsers from guessing file types in a way that can be exploited.",
    },
    {
      header: "X-Frame-Options",
      present: !!lower["x-frame-options"] || /frame-ancestors/i.test(lower["content-security-policy"] ?? ""),
      note: "Prevents this page from being embedded in a hidden iframe on another site (clickjacking).",
    },
    {
      header: "Content-Security-Policy",
      present: !!lower["content-security-policy"],
      note: "Restricts which scripts/resources can run on the page, the main defense against XSS.",
    },
    {
      header: "Referrer-Policy",
      present: !!lower["referrer-policy"],
      note: "Controls how much of this page's URL is leaked to other sites via the Referer header.",
    },
    {
      header: "Permissions-Policy",
      present: !!lower["permissions-policy"],
      note: "Limits which browser features (camera, mic, geolocation) this page and any embeds can use.",
    },
  ];

  const presentCount = checks.filter((c) => c.present).length + (isHttps ? 1 : 0);
  const total = checks.length + 1;
  const ratio = presentCount / total;
  const grade: SecurityHeadersResult["grade"] = ratio >= 0.75 ? "good" : ratio >= 0.4 ? "fair" : "poor";

  return { isHttps, checks, grade };
}
