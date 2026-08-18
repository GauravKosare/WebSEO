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
  localSeo?: {
    structuredDataTypes: string[];
    hasLocalBusinessSchema: boolean;
    hasPhoneNumber: boolean;
    hasAddressPattern: boolean;
    hasEmbeddedMap: boolean;
    hasHoursText: boolean;
  };
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
  scoreHistory?: { score: number; performanceScore?: number | null; accessibilityScore?: number | null; scannedAt: string }[];
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
  const [emailAddress, setEmailAddress] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [errors, setErrors] = useState<{ ai?: string; keywords?: string; strategy?: string; links?: string; compare?: string; email?: string }>({});

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

  async function sendReportEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!emailAddress.trim()) return;
    setEmailLoading(true);
    setErrors((e) => ({ ...e, email: undefined }));
    try {
      const res = await fetch(`/api/report/${scan._id}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailAddress.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send the report.");
      setEmailSent(true);
    } catch (err) {
      setErrors((e) => ({ ...e, email: err instanceof Error ? err.message : "Failed." }));
    } finally {
      setEmailLoading(false);
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
          <a
            href={`/api/report/${scan._id}/pdf`}
            className="mt-3 ml-2 inline-block rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Download PDF
          </a>
          {!showEmailForm && !emailSent && (
            <button
              onClick={() => setShowEmailForm(true)}
              className="mt-3 ml-2 rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              Email report
            </button>
          )}
          {emailSent && <p className="mt-3 ml-2 inline-block text-xs text-green-600">✓ Report sent to {emailAddress}</p>}
          {showEmailForm && !emailSent && (
            <form onSubmit={sendReportEmail} className="mt-3 ml-2 inline-flex gap-1.5 align-middle">
              <input
                type="email"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                placeholder="you@example.com"
                disabled={emailLoading}
                className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-900"
              />
              <button
                type="submit"
                disabled={emailLoading}
                className="rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {emailLoading ? "Sending…" : "Send"}
              </button>
            </form>
          )}
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
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

      {scan.scoreHistory && scan.scoreHistory.length > 1 && (
        <div className="mt-6 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-sm font-medium">Score trend</p>
          <p className="mb-3 text-xs text-neutral-500">From daily monitoring — SEO score and PageSpeed performance over time.</p>
          <TrendChart history={scan.scoreHistory} />
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

      {scan.localSeo && (
        <section className="mt-10 rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
          <h2 className="text-xl font-semibold">Local SEO signals</h2>
          <p className="text-xs text-neutral-500">
            For businesses with a physical location or service area. Detected on-page — not connected to your actual Google
            Business Profile.
          </p>
          <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <LocalSeoCheck ok={scan.localSeo.hasLocalBusinessSchema} label="LocalBusiness structured data" />
            <LocalSeoCheck ok={scan.localSeo.hasPhoneNumber} label="Phone number found" />
            <LocalSeoCheck ok={scan.localSeo.hasAddressPattern} label="Physical address found" />
            <LocalSeoCheck ok={scan.localSeo.hasEmbeddedMap} label="Embedded map" />
            <LocalSeoCheck ok={scan.localSeo.hasHoursText} label="Hours of operation text" />
          </ul>
          {scan.localSeo.structuredDataTypes.length > 0 && (
            <p className="mt-3 text-xs text-neutral-500">
              Structured data types found: {scan.localSeo.structuredDataTypes.join(", ")}
            </p>
          )}
        </section>
      )}

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

const CHART_WIDTH = 600;
const CHART_HEIGHT = 140;
const CHART_PAD = 8;

function buildLinePath(points: (number | null | undefined)[]): string {
  const validIndices = points.map((v, i) => (typeof v === "number" ? i : -1)).filter((i) => i >= 0);
  if (validIndices.length === 0) return "";
  const stepX = points.length > 1 ? (CHART_WIDTH - CHART_PAD * 2) / (points.length - 1) : 0;
  const toXY = (i: number, v: number) => {
    const x = CHART_PAD + stepX * i;
    const y = CHART_PAD + (1 - v / 100) * (CHART_HEIGHT - CHART_PAD * 2);
    return `${x},${y}`;
  };
  return validIndices.map((i) => toXY(i, points[i] as number)).join(" L ");
}

function TrendChart({
  history,
}: {
  history: { score: number; performanceScore?: number | null; accessibilityScore?: number | null; scannedAt: string }[];
}) {
  const scores = history.map((h) => h.score);
  const perf = history.map((h) => h.performanceScore ?? null);
  const hasPerf = perf.some((v) => typeof v === "number");

  const scorePath = buildLinePath(scores);
  const perfPath = hasPerf ? buildLinePath(perf) : "";

  const firstDate = new Date(history[0].scannedAt);
  const lastDate = new Date(history[history.length - 1].scannedAt);

  return (
    <div>
      <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full" preserveAspectRatio="none">
        {[0, 25, 50, 75, 100].map((y) => (
          <line
            key={y}
            x1={CHART_PAD}
            x2={CHART_WIDTH - CHART_PAD}
            y1={CHART_PAD + (1 - y / 100) * (CHART_HEIGHT - CHART_PAD * 2)}
            y2={CHART_PAD + (1 - y / 100) * (CHART_HEIGHT - CHART_PAD * 2)}
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeWidth={1}
            className="text-neutral-500"
          />
        ))}
        {scorePath && <path d={`M ${scorePath}`} fill="none" stroke="#2563eb" strokeWidth={2} />}
        {perfPath && <path d={`M ${perfPath}`} fill="none" stroke="#d97706" strokeWidth={2} strokeDasharray="4 3" />}
      </svg>
      <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
        <span>{firstDate.toLocaleDateString()}</span>
        <div className="flex gap-4">
          <span className="flex items-center gap-1">
            <span className="h-0.5 w-3 bg-blue-600" /> SEO score
          </span>
          {hasPerf && (
            <span className="flex items-center gap-1">
              <span className="h-0.5 w-3 border-t-2 border-dashed border-amber-600" /> Performance
            </span>
          )}
        </div>
        <span>{lastDate.toLocaleDateString()}</span>
      </div>
    </div>
  );
}

function LocalSeoCheck({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
          ok ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" : "bg-neutral-100 text-neutral-400 dark:bg-neutral-900"
        }`}
      >
        {ok ? "✓" : "–"}
      </span>
      {label}
    </li>
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
