export type ValidationSeverity = "critical" | "warning" | "info";

export type ValidationIssue = {
  severity: ValidationSeverity;
  title: string;
  detail: string;
};

const VALID_ROBOTS_DIRECTIVES = new Set([
  "user-agent",
  "disallow",
  "allow",
  "sitemap",
  "crawl-delay",
  "host",
  "clean-param",
  "noindex",
]);

export function validateRobotsTxt(robotsStatus: number | null, robotsBody: string | null, sitemapUrl: string | null): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (robotsStatus === null || robotsStatus >= 400) {
    issues.push({
      severity: "info",
      title: "No robots.txt found",
      detail: "Not required, but a robots.txt is the standard place to point crawlers at your sitemap and control what they can access.",
    });
    return issues;
  }

  const body = robotsBody ?? "";
  const lines = body.split("\n").map((l) => l.trim());

  let blocksEverything = false;
  let currentUserAgentIsWildcard = false;
  let malformedLines = 0;

  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([a-zA-Z-]+)\s*:\s*(.*)$/);
    if (!match) {
      malformedLines++;
      continue;
    }
    const field = match[1].toLowerCase();
    const value = match[2].trim();

    if (!VALID_ROBOTS_DIRECTIVES.has(field)) {
      malformedLines++;
      continue;
    }

    if (field === "user-agent") {
      currentUserAgentIsWildcard = value === "*";
    }
    if (field === "disallow" && currentUserAgentIsWildcard && value === "/") {
      blocksEverything = true;
    }
  }

  if (blocksEverything) {
    issues.push({
      severity: "critical",
      title: "robots.txt blocks all crawlers",
      detail: "\"User-agent: * / Disallow: /\" tells every search engine not to crawl any page on this site. Remove it if that's not intentional.",
    });
  }

  if (malformedLines > 0) {
    issues.push({
      severity: "warning",
      title: "robots.txt has unrecognized lines",
      detail: `${malformedLines} line(s) don't match a known robots.txt directive (User-agent, Disallow, Allow, Sitemap, etc.) and will likely be ignored by crawlers.`,
    });
  }

  if (!/^\s*sitemap:/im.test(body) && sitemapUrl) {
    issues.push({
      severity: "info",
      title: "robots.txt doesn't reference the sitemap",
      detail: `Add "Sitemap: ${sitemapUrl}" to robots.txt so crawlers can discover it without guessing the URL.`,
    });
  }

  return issues;
}

const SITEMAP_MAX_URLS = 50_000; // sitemaps.org protocol limit per file
const SITEMAP_MAX_BYTES = 50 * 1024 * 1024; // uncompressed protocol limit per file

export function validateSitemapXml(
  xml: string,
  allLocs: string[],
  sameOriginLocs: string[],
  origin: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!/^\s*<\?xml/i.test(xml) && !/<urlset[\s>]/i.test(xml) && !/<sitemapindex[\s>]/i.test(xml)) {
    issues.push({
      severity: "critical",
      title: "Sitemap doesn't look like valid XML",
      detail: "The response didn't start with an XML declaration or contain a <urlset>/<sitemapindex> root element.",
    });
    return issues;
  }

  const crossOriginCount = allLocs.length - sameOriginLocs.length;
  if (crossOriginCount > 0) {
    issues.push({
      severity: "warning",
      title: "Sitemap lists URLs from a different domain",
      detail: `${crossOriginCount} <loc> entries point to a different origin than ${origin}. A sitemap should only list URLs from its own site.`,
    });
  }

  const seen = new Set<string>();
  let duplicates = 0;
  for (const loc of allLocs) {
    if (seen.has(loc)) duplicates++;
    seen.add(loc);
  }
  if (duplicates > 0) {
    issues.push({
      severity: "info",
      title: "Sitemap has duplicate URLs",
      detail: `${duplicates} duplicate <loc> entries found. Harmless, but worth cleaning up.`,
    });
  }

  if (allLocs.length > SITEMAP_MAX_URLS) {
    issues.push({
      severity: "critical",
      title: "Sitemap exceeds the 50,000 URL limit",
      detail: `This sitemap file lists ${allLocs.length} URLs, over the sitemaps.org protocol limit of 50,000 per file. Split it into multiple sitemaps referenced from a sitemap index.`,
    });
  }

  if (xml.length > SITEMAP_MAX_BYTES) {
    issues.push({
      severity: "warning",
      title: "Sitemap file is very large",
      detail: "This sitemap is approaching or over the 50MB uncompressed protocol limit per file.",
    });
  }

  if (!/<lastmod>/i.test(xml)) {
    issues.push({
      severity: "info",
      title: "No <lastmod> dates in sitemap",
      detail: "Adding <lastmod> to each URL helps search engines prioritize recrawling pages that actually changed.",
    });
  }

  return issues;
}
