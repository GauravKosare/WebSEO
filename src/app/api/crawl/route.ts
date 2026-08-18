import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { SiteCrawl } from "@/lib/models/SiteCrawl";
import { getOrCreateVisitorId } from "@/lib/visitor";
import { getClientIp } from "@/lib/clientIp";
import { discoverSitemapUrls } from "@/lib/audit/sitemap";
import { fetchPageSafely } from "@/lib/audit/crawler";
import { parsePage } from "@/lib/audit/parsePage";
import { runAuditRules } from "@/lib/audit/rules";
import { UnsafeUrlError } from "@/lib/audit/urlSafety";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({ url: z.string().min(1).max(2048) });

const MAX_CRAWLS_PER_HOUR = 5;
const MAX_PAGES_PER_CRAWL = 12;
const CRAWL_CONCURRENCY = 4;
const TIME_BUDGET_MS = 45_000; // leaves headroom for sitemap discovery + response write under maxDuration

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid URL is required." }, { status: 400 });
  }

  await connectToDatabase();
  const { id: visitorId } = await getOrCreateVisitorId();
  const clientIp = getClientIp(req);

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await SiteCrawl.countDocuments({
    createdAt: { $gte: oneHourAgo },
    $or: [{ visitorId }, ...(clientIp ? [{ clientIp }] : [])],
  });
  if (recentCount >= MAX_CRAWLS_PER_HOUR) {
    return NextResponse.json({ error: "Site crawl limit reached. Please try again later." }, { status: 429 });
  }

  let normalizedUrl = parsed.data.url.trim();
  if (!/^https?:\/\//i.test(normalizedUrl)) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  try {
    const { sitemapUrl, urls, validationIssues } = await discoverSitemapUrls(normalizedUrl);
    const targets = urls.slice(0, MAX_PAGES_PER_CRAWL);

    const start = Date.now();
    const pages: {
      url: string;
      finalUrl?: string;
      score?: number;
      issueCount?: number;
      criticalIssueCount?: number;
      topIssues?: string[];
      status: "ok" | "error";
      error?: string;
    }[] = new Array(targets.length);
    let skippedForTime = 0;
    let nextIndex = 0;

    async function worker() {
      while (true) {
        if (Date.now() - start > TIME_BUDGET_MS) return;
        const i = nextIndex++;
        if (i >= targets.length) return;
        try {
          const page = await fetchPageSafely(targets[i]);
          const parsedPage = parsePage(page.html, page.finalUrl);
          const { issues, score } = runAuditRules(parsedPage);
          pages[i] = {
            url: targets[i],
            finalUrl: page.finalUrl,
            score,
            issueCount: issues.length,
            criticalIssueCount: issues.filter((iss) => iss.severity === "critical").length,
            topIssues: issues.slice(0, 3).map((iss) => iss.title),
            status: "ok",
          };
        } catch (err) {
          pages[i] = {
            url: targets[i],
            status: "error",
            error: err instanceof UnsafeUrlError ? err.message : "Could not scan this page.",
          };
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(CRAWL_CONCURRENCY, targets.length) }, worker));

    const scannedPages = pages.filter(Boolean);
    skippedForTime = targets.length - scannedPages.length;
    const okPages = scannedPages.filter((p) => p.status === "ok" && typeof p.score === "number");
    const overallScore = okPages.length > 0 ? Math.round(okPages.reduce((sum, p) => sum + (p.score ?? 0), 0) / okPages.length) : null;

    const crawl = await SiteCrawl.create({
      visitorId,
      clientIp,
      rootUrl: normalizedUrl,
      sitemapUrl,
      totalUrlsFound: urls.length,
      pages: scannedPages,
      overallScore,
      skippedForTime,
      validationIssues,
    });

    return NextResponse.json({ id: crawl._id.toString() }, { status: 201 });
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Site crawl failed", err);
    return NextResponse.json({ error: "Something went wrong while crawling that site." }, { status: 502 });
  }
}
