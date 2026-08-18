"use client";

import { useState } from "react";

type Issue = {
  id: string;
  severity: "critical" | "warning" | "info";
  category: string;
  title: string;
  detail: string;
};

type AiContent = {
  title: string;
  titleRationale: string;
  metaDescription: string;
  h1: string;
  altTextSuggestions: { forImageSrc: string; suggestedAlt: string }[];
  eeatRecommendations: string[];
  summary: string;
};

type KeywordIdea = {
  keyword: string;
  intent: string;
  funnelStage: "awareness" | "consideration" | "decision";
  keywordType: "primary" | "secondary" | "long-tail";
  estimatedDifficulty: "low" | "medium" | "high";
  reason: string;
};

type SeoStrategy = {
  primaryKeyword: string;
  searchIntent: string;
  contentGapAnalysis: string;
  recommendedHeadingOutline: { level: "H2" | "H3"; text: string }[];
  recommendedWordCount: number;
  internalLinkingIdeas: string[];
  schemaMarkupSuggestions: string[];
};

export type ScanData = {
  _id: string;
  url: string;
  finalUrl?: string;
  score: number;
  issues: Issue[];
  pageSpeed?: {
    performanceScore: number | null;
    seoScore: number | null;
    accessibilityScore: number | null;
    isMobileFriendly: boolean | null;
    error?: string;
  };
  aiContent?: AiContent;
  keywordIdeas?: KeywordIdea[];
  seoStrategy?: SeoStrategy;
  readability?: {
    fleschScore: number;
    gradeLevel: string;
    sentenceCount: number;
    wordCount: number;
    avgWordsPerSentence: number;
  } | null;
  internalLinkUrls?: string[];
  linkCheck?: {
    checkedAt?: string;
    brokenCount?: number;
    longRedirectCount?: number;
    results?: { url: string; status: "ok" | "redirect" | "broken" | "error"; statusCode: number | null; redirectCount: number; finalUrl: string | null }[];
  };
  competitorComparison?: {
    competitorUrl?: string;
    competitorFinalUrl?: string;
    competitorScore?: number;
    scoreDelta?: number;
    gapAnalysis?: string;
    competitorAdvantages?: string[];
    ourAdvantages?: string[];
    keywordGaps?: string[];
  };
  monitoringEnabled?: boolean;
  createdAt: string;
};

type LinkStatus = "ok" | "redirect" | "broken" | "error";

const LINK_STATUS_STYLES: Record<LinkStatus, string> = {
  ok: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  redirect: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  broken: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  error: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const SEVERITY_STYLES: Record<Issue["severity"], string> = {
  critical: "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  warning: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  info: "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
};

const DIFFICULTY_STYLES: Record<KeywordIdea["estimatedDifficulty"], string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  high: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? "text-green-600" : score >= 50 ? "text-amber-600" : "text-red-600";
  return (
    <div className={`flex h-24 w-24 items-center justify-center rounded-full border-4 ${color} border-current text-3xl font-bold`}>
      {score}
    </div>
  );
}

export default function ResultsClient({ initialScan }: { initialScan: ScanData }) {
  const [scan, setScan] = useState(initialScan);
  const [aiLoading, setAiLoading] = useState(false);
  const [keywordsLoading, setKeywordsLoading] = useState(false);
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [linksLoading, setLinksLoading] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [errors, setErrors] = useState<{ ai?: string; keywords?: string; strategy?: string; links?: string; compare?: string }>({});

  async function generateAi() {
    setAiLoading(true);
    setErrors((e) => ({ ...e, ai: undefined }));
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId: scan._id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate AI suggestions.");
      setScan((s) => ({ ...s, aiContent: data.aiContent }));
    } catch (err) {
      setErrors((e) => ({ ...e, ai: err instanceof Error ? err.message : "Failed." }));
    } finally {
      setAiLoading(false);
    }
  }

  async function generateKeywords() {
    setKeywordsLoading(true);
    setErrors((e) => ({ ...e, keywords: undefined }));
    try {
      const res = await fetch("/api/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId: scan._id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate keyword ideas.");
      setScan((s) => ({ ...s, keywordIdeas: data.keywordIdeas }));
    } catch (err) {
      setErrors((e) => ({ ...e, keywords: err instanceof Error ? err.message : "Failed." }));
    } finally {
      setKeywordsLoading(false);
    }
  }

  async function generateStrategy() {
    setStrategyLoading(true);
    setErrors((e) => ({ ...e, strategy: undefined }));
    try {
      const res = await fetch("/api/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId: scan._id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate a content strategy.");
      setScan((s) => ({ ...s, seoStrategy: data.seoStrategy }));
    } catch (err) {
      setErrors((e) => ({ ...e, strategy: err instanceof Error ? err.message : "Failed." }));
    } finally {
      setStrategyLoading(false);
    }
  }

  async function checkLinksHandler() {
    setLinksLoading(true);
    setErrors((e) => ({ ...e, links: undefined }));
    try {
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId: scan._id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to check links.");
      setScan((s) => ({ ...s, linkCheck: data.linkCheck }));
    } catch (err) {
      setErrors((e) => ({ ...e, links: err instanceof Error ? err.message : "Failed." }));
    } finally {
      setLinksLoading(false);
    }
  }

  async function compareCompetitor(e: React.FormEvent) {
    e.preventDefault();
    if (!competitorUrl.trim()) return;
    setCompareLoading(true);
    setErrors((e) => ({ ...e, compare: undefined }));
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId: scan._id, competitorUrl: competitorUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to compare against that competitor.");
      setScan((s) => ({ ...s, competitorComparison: data.competitorComparison }));
    } catch (err) {
      setErrors((e) => ({ ...e, compare: err instanceof Error ? err.message : "Failed." }));
    } finally {
      setCompareLoading(false);
    }
  }

  async function toggleMonitoring() {
    setMonitorLoading(true);
    try {
      const res = await fetch(`/api/audit/${scan._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monitoringEnabled: !scan.monitoringEnabled }),
      });
      const data = await res.json();
      if (res.ok) setScan((s) => ({ ...s, monitoringEnabled: data.monitoringEnabled }));
    } finally {
      setMonitorLoading(false);
    }
  }

  const grouped = scan.issues.reduce<Record<string, Issue[]>>((acc, issue) => {
    (acc[issue.category] ??= []).push(issue);
    return acc;
  }, {});

  const hasStrategy = !!scan.seoStrategy;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
        <div>
          <p className="text-sm text-neutral-500">Scan result for</p>
          <p className="break-all text-lg font-medium">{scan.finalUrl ?? scan.url}</p>
          <button
            onClick={toggleMonitoring}
            disabled={monitorLoading}
            className="mt-3 rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            {scan.monitoringEnabled ? "✓ Daily monitoring on" : "Enable daily monitoring"}
          </button>
        </div>
        <ScoreRing score={scan.score} />
      </div>

      {scan.pageSpeed && (
        <div className="mt-6 grid grid-cols-3 gap-4">
          <Metric label="Performance" value={scan.pageSpeed.performanceScore} />
          <Metric label="SEO (Lighthouse)" value={scan.pageSpeed.seoScore} />
          <Metric label="Accessibility" value={scan.pageSpeed.accessibilityScore} />
        </div>
      )}
      {scan.pageSpeed?.error && (
        <p className="mt-2 text-xs text-neutral-500">Speed data unavailable: {scan.pageSpeed.error}</p>
      )}

      {scan.readability && (
        <div className="mt-6 flex items-center justify-between rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <div>
            <p className="text-sm font-medium">Readability</p>
            <p className="text-xs text-neutral-500">
              {scan.readability.gradeLevel} · {scan.readability.avgWordsPerSentence} words/sentence avg
            </p>
          </div>
          <p className="text-2xl font-semibold">{scan.readability.fleschScore}</p>
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Issues found ({scan.issues.length})</h2>
        <div className="mt-4 space-y-6">
          {Object.entries(grouped).map(([category, issues]) => (
            <div key={category}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">{category}</h3>
              <div className="space-y-2">
                {issues.map((issue) => (
                  <div key={issue.id} className={`rounded-lg border p-3 ${SEVERITY_STYLES[issue.severity]}`}>
                    <p className="font-medium">{issue.title}</p>
                    <p className="mt-0.5 text-sm opacity-90">{issue.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {scan.issues.length === 0 && <p className="text-neutral-500">No issues found. Nicely done.</p>}
        </div>
      </section>

      <section className="mt-10 rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">AI-written fixes</h2>
          {!scan.aiContent && (
            <button
              onClick={generateAi}
              disabled={aiLoading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {aiLoading ? "Generating…" : "Generate suggestions"}
            </button>
          )}
        </div>
        {errors.ai && <p className="mt-2 text-sm text-red-600">{errors.ai}</p>}
        {scan.aiContent && (
          <div className="mt-4 space-y-4 text-sm">
            <Field label="Suggested title" value={scan.aiContent.title} hint={scan.aiContent.titleRationale} />
            <Field label="Suggested meta description" value={scan.aiContent.metaDescription} />
            <Field label="Suggested H1" value={scan.aiContent.h1} />
            <p className="text-neutral-600 dark:text-neutral-400">{scan.aiContent.summary}</p>
            {scan.aiContent.eeatRecommendations.length > 0 && (
              <div>
                <p className="font-medium">Trust &amp; credibility (E-E-A-T) signals to add</p>
                <ul className="mt-1 list-inside list-disc space-y-1 text-neutral-600 dark:text-neutral-400">
                  {scan.aiContent.eeatRecommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
            {scan.aiContent.altTextSuggestions.length > 0 && (
              <div>
                <p className="font-medium">Alt text suggestions</p>
                <ul className="mt-1 space-y-1">
                  {scan.aiContent.altTextSuggestions.map((a, i) => (
                    <li key={i} className="text-neutral-600 dark:text-neutral-400">
                      <span className="break-all text-xs text-neutral-400">{a.forImageSrc}</span>
                      <br />→ {a.suggestedAlt}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="mt-10 rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Keyword ideas</h2>
          {(!scan.keywordIdeas || scan.keywordIdeas.length === 0) && (
            <button
              onClick={generateKeywords}
              disabled={keywordsLoading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {keywordsLoading ? "Generating…" : "Generate ideas"}
            </button>
          )}
        </div>
        {errors.keywords && <p className="mt-2 text-sm text-red-600">{errors.keywords}</p>}
        {scan.keywordIdeas && scan.keywordIdeas.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
                  <th className="py-2 pr-4">Keyword</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Funnel</th>
                  <th className="py-2 pr-4">Intent</th>
                  <th className="py-2 pr-4">Difficulty</th>
                  <th className="py-2">Why</th>
                </tr>
              </thead>
              <tbody>
                {scan.keywordIdeas.map((k, i) => (
                  <tr key={i} className="border-b border-neutral-100 dark:border-neutral-900">
                    <td className="py-2 pr-4 font-medium">{k.keyword}</td>
                    <td className="py-2 pr-4 capitalize">{k.keywordType}</td>
                    <td className="py-2 pr-4 capitalize">{k.funnelStage}</td>
                    <td className="py-2 pr-4 capitalize">{k.intent}</td>
                    <td className="py-2 pr-4">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${DIFFICULTY_STYLES[k.estimatedDifficulty]}`}>
                        {k.estimatedDifficulty}
                      </span>
                    </td>
                    <td className="py-2 text-neutral-600 dark:text-neutral-400">{k.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-neutral-500">AI estimates based on page content, not real search-volume data.</p>
          </div>
        )}
      </section>

      <section className="mt-10 rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Link health</h2>
            <p className="text-xs text-neutral-500">
              Checks up to 20 internal links found on this page for broken links (4xx/5xx) and long redirect chains.
            </p>
          </div>
          {!scan.linkCheck?.checkedAt && (
            <button
              onClick={checkLinksHandler}
              disabled={linksLoading || !scan.internalLinkUrls?.length}
              className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {linksLoading ? "Checking…" : "Check links"}
            </button>
          )}
        </div>
        {errors.links && <p className="mt-2 text-sm text-red-600">{errors.links}</p>}
        {!scan.internalLinkUrls?.length && !scan.linkCheck?.checkedAt && (
          <p className="mt-2 text-xs text-neutral-500">No internal links were found on this page.</p>
        )}
        {scan.linkCheck?.checkedAt && (
          <div className="mt-4">
            <div className="flex gap-6 text-sm">
              <p>
                <span className="font-semibold text-red-600">{scan.linkCheck.brokenCount}</span> broken
              </p>
              <p>
                <span className="font-semibold text-amber-600">{scan.linkCheck.longRedirectCount}</span> redirect chains
              </p>
              <p className="text-neutral-500">{(scan.linkCheck.results ?? []).length} checked</p>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
                    <th className="py-2 pr-4">URL</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Code</th>
                    <th className="py-2">Redirects</th>
                  </tr>
                </thead>
                <tbody>
                  {(scan.linkCheck.results ?? []).map((r, i) => (
                    <tr key={i} className="border-b border-neutral-100 dark:border-neutral-900">
                      <td className="max-w-xs truncate py-2 pr-4 font-mono text-xs" title={r.url}>
                        {r.url}
                      </td>
                      <td className="py-2 pr-4">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${LINK_STATUS_STYLES[r.status]}`}>{r.status}</span>
                      </td>
                      <td className="py-2 pr-4">{r.statusCode ?? "—"}</td>
                      <td className="py-2">{r.redirectCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="mt-10 rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">AI content strategy</h2>
            <p className="text-xs text-neutral-500">A rewrite brief for actually competing for rankings, not just tag fixes.</p>
          </div>
          {!hasStrategy && (
            <button
              onClick={generateStrategy}
              disabled={strategyLoading}
              className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {strategyLoading ? "Generating…" : "Generate strategy"}
            </button>
          )}
        </div>
        {errors.strategy && <p className="mt-2 text-sm text-red-600">{errors.strategy}</p>}
        {scan.seoStrategy && (
          <div className="mt-4 space-y-5 text-sm">
            <div className="flex flex-wrap gap-6">
              <Field label="Primary keyword" value={scan.seoStrategy.primaryKeyword} />
              <Field label="Search intent" value={scan.seoStrategy.searchIntent} className="capitalize" />
              <Field label="Target word count" value={`~${scan.seoStrategy.recommendedWordCount.toLocaleString()} words`} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Content gap analysis</p>
              <p className="mt-0.5 text-neutral-700 dark:text-neutral-300">{scan.seoStrategy.contentGapAnalysis}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Recommended heading outline</p>
              <ul className="mt-1 space-y-1">
                {scan.seoStrategy.recommendedHeadingOutline.map((h, i) => (
                  <li key={i} className={h.level === "H3" ? "ml-4 text-neutral-600 dark:text-neutral-400" : "font-medium"}>
                    <span className="mr-2 text-xs text-neutral-400">{h.level}</span>
                    {h.text}
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Internal linking ideas</p>
                <ul className="mt-1 list-inside list-disc space-y-1 text-neutral-600 dark:text-neutral-400">
                  {scan.seoStrategy.internalLinkingIdeas.map((idea, i) => (
                    <li key={i}>{idea}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Structured data to add</p>
                <ul className="mt-1 list-inside list-disc space-y-1 text-neutral-600 dark:text-neutral-400">
                  {scan.seoStrategy.schemaMarkupSuggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="mt-10 rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
        <div>
          <h2 className="text-xl font-semibold">Competitor comparison</h2>
          <p className="text-xs text-neutral-500">Scan a competing page and see where it beats yours.</p>
        </div>
        <form onSubmit={compareCompetitor} className="mt-4 flex gap-2">
          <input
            type="text"
            value={competitorUrl}
            onChange={(e) => setCompetitorUrl(e.target.value)}
            placeholder="competitor.com"
            disabled={compareLoading}
            className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <button
            type="submit"
            disabled={compareLoading}
            className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {compareLoading ? "Comparing…" : "Compare"}
          </button>
        </form>
        {errors.compare && <p className="mt-2 text-sm text-red-600">{errors.compare}</p>}
        {scan.competitorComparison?.competitorUrl && (
          <div className="mt-5 space-y-5 text-sm">
            <div className="flex items-center gap-8 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <div>
                <p className="text-xs text-neutral-500">Your score</p>
                <p className="text-2xl font-semibold">{scan.score}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">{scan.competitorComparison.competitorFinalUrl}</p>
                <p className="text-2xl font-semibold">{scan.competitorComparison.competitorScore}</p>
              </div>
              <p
                className={`ml-auto text-sm font-medium ${(scan.competitorComparison.scoreDelta ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                {(scan.competitorComparison.scoreDelta ?? 0) >= 0 ? "+" : ""}
                {scan.competitorComparison.scoreDelta} vs. competitor
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Gap analysis</p>
              <p className="mt-0.5 text-neutral-700 dark:text-neutral-300">{scan.competitorComparison.gapAnalysis}</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Where the competitor is ahead</p>
                <ul className="mt-1 list-inside list-disc space-y-1 text-neutral-600 dark:text-neutral-400">
                  {(scan.competitorComparison.competitorAdvantages ?? []).map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                  {(scan.competitorComparison.competitorAdvantages ?? []).length === 0 && <li>None identified.</li>}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Where you're ahead</p>
                <ul className="mt-1 list-inside list-disc space-y-1 text-neutral-600 dark:text-neutral-400">
                  {(scan.competitorComparison.ourAdvantages ?? []).map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                  {(scan.competitorComparison.ourAdvantages ?? []).length === 0 && <li>None identified.</li>}
                </ul>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Keyword/topic gaps</p>
              <ul className="mt-1 list-inside list-disc space-y-1 text-neutral-600 dark:text-neutral-400">
                {(scan.competitorComparison.keywordGaps ?? []).map((k, i) => (
                  <li key={i}>{k}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4 text-center dark:border-neutral-800">
      <p className="text-2xl font-semibold">{value ?? "—"}</p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  );
}

function Field({ label, value, hint, className }: { label: string; value: string; hint?: string; className?: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-0.5 ${className ?? ""}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}
