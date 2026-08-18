"use client";

import Link from "next/link";

type CrawledPage = {
  url: string;
  finalUrl?: string;
  score?: number;
  issueCount?: number;
  criticalIssueCount?: number;
  topIssues?: string[];
  status: "ok" | "error";
  error?: string;
};

type ValidationIssue = { severity: "critical" | "warning" | "info"; title: string; detail: string };

export type CrawlData = {
  _id: string;
  rootUrl: string;
  sitemapUrl?: string;
  totalUrlsFound: number;
  pages: CrawledPage[];
  overallScore: number | null;
  skippedForTime: number;
  validationIssues?: ValidationIssue[];
  createdAt: string;
};

function scoreColor(score: number) {
  if (score >= 80) return "text-green-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-600";
}

const VALIDATION_STYLES: Record<ValidationIssue["severity"], string> = {
  critical: "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  warning: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  info: "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
};

export default function CrawlResultsClient({ crawl }: { crawl: CrawlData }) {
  const okPages = crawl.pages.filter((p) => p.status === "ok").sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
  const errorPages = crawl.pages.filter((p) => p.status === "error");

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
        <p className="text-sm text-neutral-500">Site crawl for</p>
        <p className="break-all text-lg font-medium">{crawl.rootUrl}</p>
        {crawl.sitemapUrl && <p className="mt-1 break-all text-xs text-neutral-500">Sitemap: {crawl.sitemapUrl}</p>}

        <div className="mt-6 flex flex-wrap items-center gap-8">
          <div>
            <p className="text-xs text-neutral-500">Site-wide average score</p>
            <p className={`text-4xl font-bold ${crawl.overallScore != null ? scoreColor(crawl.overallScore) : ""}`}>
              {crawl.overallScore ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Pages found in sitemap</p>
            <p className="text-2xl font-semibold">{crawl.totalUrlsFound}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Pages scanned</p>
            <p className="text-2xl font-semibold">{crawl.pages.length}</p>
          </div>
        </div>

        {crawl.totalUrlsFound > crawl.pages.length && (
          <p className="mt-4 text-xs text-neutral-500">
            Scanned {crawl.pages.length} of {crawl.totalUrlsFound} pages found in the sitemap (capped per crawl to keep results
            fast{crawl.skippedForTime > 0 ? `; ${crawl.skippedForTime} were skipped this run for time` : ""}).
          </p>
        )}
      </div>

      {crawl.validationIssues && crawl.validationIssues.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Sitemap &amp; robots.txt validation</h2>
          <div className="mt-4 space-y-2">
            {crawl.validationIssues.map((v, i) => (
              <div key={i} className={`rounded-lg border p-3 text-sm ${VALIDATION_STYLES[v.severity]}`}>
                <p className="font-medium">{v.title}</p>
                <p className="mt-0.5 opacity-90">{v.detail}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Pages, worst score first ({okPages.length})</h2>
        <div className="mt-4 space-y-2">
          {okPages.map((p) => (
            <div key={p.url} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
              <div className="flex items-center justify-between gap-4">
                <p className="truncate text-sm font-medium">{p.finalUrl ?? p.url}</p>
                <span className={`shrink-0 text-lg font-semibold ${scoreColor(p.score ?? 0)}`}>{p.score}</span>
              </div>
              {p.topIssues && p.topIssues.length > 0 && (
                <p className="mt-1 text-xs text-neutral-500">
                  {p.criticalIssueCount ? `${p.criticalIssueCount} critical · ` : ""}
                  {p.topIssues.join(" · ")}
                  {p.issueCount && p.issueCount > p.topIssues.length ? ` +${p.issueCount - p.topIssues.length} more` : ""}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {errorPages.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Couldn&apos;t scan ({errorPages.length})</h2>
          <div className="mt-4 space-y-2">
            {errorPages.map((p) => (
              <div key={p.url} className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950">
                <p className="truncate font-medium">{p.url}</p>
                <p className="mt-0.5 text-xs text-red-700 dark:text-red-300">{p.error}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="mt-10 text-center">
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          Run another scan
        </Link>
      </p>
    </div>
  );
}
