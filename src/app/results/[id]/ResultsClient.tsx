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
  metaDescription: string;
  h1: string;
  altTextSuggestions: { forImageSrc: string; suggestedAlt: string }[];
  summary: string;
};

type KeywordIdea = {
  keyword: string;
  intent: string;
  estimatedDifficulty: "low" | "medium" | "high";
  reason: string;
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
  monitoringEnabled?: boolean;
  createdAt: string;
};

const SEVERITY_STYLES: Record<Issue["severity"], string> = {
  critical: "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  warning: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  info: "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
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
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [errors, setErrors] = useState<{ ai?: string; keywords?: string }>({});

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
            <Field label="Suggested title" value={scan.aiContent.title} />
            <Field label="Suggested meta description" value={scan.aiContent.metaDescription} />
            <Field label="Suggested H1" value={scan.aiContent.h1} />
            <p className="text-neutral-600 dark:text-neutral-400">{scan.aiContent.summary}</p>
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
          {!scan.keywordIdeas && (
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
        {scan.keywordIdeas && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
                  <th className="py-2 pr-4">Keyword</th>
                  <th className="py-2 pr-4">Intent</th>
                  <th className="py-2 pr-4">Est. difficulty</th>
                  <th className="py-2">Why</th>
                </tr>
              </thead>
              <tbody>
                {scan.keywordIdeas.map((k, i) => (
                  <tr key={i} className="border-b border-neutral-100 dark:border-neutral-900">
                    <td className="py-2 pr-4 font-medium">{k.keyword}</td>
                    <td className="py-2 pr-4 capitalize">{k.intent}</td>
                    <td className="py-2 pr-4 capitalize">{k.estimatedDifficulty}</td>
                    <td className="py-2 text-neutral-600 dark:text-neutral-400">{k.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-neutral-500">AI estimates based on page content, not real search-volume data.</p>
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-0.5">{value}</p>
    </div>
  );
}
