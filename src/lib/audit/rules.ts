import type { ParsedPage } from "./parsePage";

export type Severity = "critical" | "warning" | "info";

export type Issue = {
  id: string;
  severity: Severity;
  category: string;
  title: string;
  detail: string;
  points: number; // points deducted from 100
};

const POINTS: Record<Severity, number> = { critical: 12, warning: 6, info: 2 };

function issue(id: string, severity: Severity, category: string, title: string, detail: string): Issue {
  return { id, severity, category, title, detail, points: POINTS[severity] };
}

export function runAuditRules(page: ParsedPage): { issues: Issue[]; score: number } {
  const issues: Issue[] = [];

  // Title
  if (!page.title) {
    issues.push(issue("title-missing", "critical", "Titles", "Missing page title", "Every page needs a unique <title> tag — it's the headline shown in search results."));
  } else if (page.title.length < 15) {
    issues.push(issue("title-short", "warning", "Titles", "Title is too short", `"${page.title}" is only ${page.title.length} characters. Aim for 50-60.`));
  } else if (page.title.length > 65) {
    issues.push(issue("title-long", "warning", "Titles", "Title is too long", `Your title is ${page.title.length} characters and will likely be truncated in search results (aim for 50-60).`));
  }

  // Meta description
  if (!page.metaDescription) {
    issues.push(issue("meta-missing", "critical", "Meta", "Missing meta description", "Add a meta description so search engines show a relevant snippet instead of a random chunk of your page."));
  } else if (page.metaDescription.length < 70) {
    issues.push(issue("meta-short", "info", "Meta", "Meta description is short", `${page.metaDescription.length} characters — aim for 120-158.`));
  } else if (page.metaDescription.length > 160) {
    issues.push(issue("meta-long", "info", "Meta", "Meta description is long", `${page.metaDescription.length} characters and will likely be truncated (aim for 120-158).`));
  }

  // H1
  if (page.h1s.length === 0) {
    issues.push(issue("h1-missing", "critical", "Headings", "Missing H1", "Every page should have exactly one H1 describing the main topic."));
  } else if (page.h1s.length > 1) {
    issues.push(issue("h1-multiple", "warning", "Headings", "Multiple H1 tags", `Found ${page.h1s.length} H1 tags. Search engines prefer a single, clear H1 per page.`));
  }

  // Content length
  if (page.wordCount < 300) {
    issues.push(issue("content-thin", "warning", "Content", "Thin content", `Only ${page.wordCount} words of visible text. Pages with under ~300 words often struggle to rank for competitive terms.`));
  }

  // Canonical
  if (!page.canonical) {
    issues.push(issue("canonical-missing", "info", "Technical", "Missing canonical tag", "A canonical link tells search engines which URL is the authoritative version, helping avoid duplicate-content issues."));
  }

  // Robots
  if (page.robotsMeta && /noindex/i.test(page.robotsMeta)) {
    issues.push(issue("robots-noindex", "critical", "Technical", "Page is set to noindex", "This page has a robots meta tag blocking it from search engines. Remove it if that's not intentional."));
  }

  // Lang
  if (!page.lang) {
    issues.push(issue("lang-missing", "info", "Technical", "Missing html lang attribute", "Add a lang attribute to <html> to help search engines and screen readers identify the page's language."));
  }

  // Images alt text
  const missingAlt = page.images.filter((img) => !img.alt || img.alt.trim() === "");
  if (page.images.length > 0 && missingAlt.length > 0) {
    const severity: Severity = missingAlt.length / page.images.length > 0.5 ? "warning" : "info";
    issues.push(
      issue(
        "images-alt-missing",
        severity,
        "Images",
        "Images missing alt text",
        `${missingAlt.length} of ${page.images.length} images have no alt text, hurting accessibility and image search visibility.`
      )
    );
  }

  // Mobile viewport
  if (!page.hasViewportMeta) {
    issues.push(issue("viewport-missing", "critical", "Mobile", "Missing viewport meta tag", "Without a viewport meta tag, mobile browsers render a desktop layout — a major mobile-usability and ranking issue."));
  }

  // Open Graph
  if (!page.hasOpenGraph) {
    issues.push(issue("og-missing", "info", "Social", "Missing Open Graph tags", "Open Graph tags control how this page looks when shared on social media."));
  }

  // Structured data
  if (!page.hasStructuredData) {
    issues.push(issue("structured-data-missing", "info", "Technical", "No structured data found", "Structured data (JSON-LD) helps search engines understand your content and can unlock rich results."));
  }

  // Internal linking
  if (page.internalLinks === 0) {
    issues.push(issue("internal-links-missing", "warning", "Links", "No internal links found", "Internal links help search engines discover and understand the relationships between your pages."));
  }

  const totalDeduction = issues.reduce((sum, i) => sum + i.points, 0);
  const score = Math.max(0, 100 - totalDeduction);

  return { issues, score };
}
