import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { Scan } from "@/lib/models/Scan";
import { getOrCreateVisitorId } from "@/lib/visitor";
import { fetchPageSafely } from "@/lib/audit/crawler";
import { parsePage } from "@/lib/audit/parsePage";
import { runAuditRules } from "@/lib/audit/rules";
import { generateCompetitorGapAnalysis, AiUnavailableError } from "@/lib/ai/gemini";
import { UnsafeUrlError } from "@/lib/audit/urlSafety";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({ scanId: z.string(), competitorUrl: z.string().min(1).max(2048) });

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !mongoose.isValidObjectId(parsed.data.scanId)) {
    return NextResponse.json({ error: "A valid scanId and competitorUrl are required." }, { status: 400 });
  }

  await connectToDatabase();
  const { id: visitorId } = await getOrCreateVisitorId();

  const scan = await Scan.findOne({ _id: parsed.data.scanId, visitorId });
  if (!scan) {
    return NextResponse.json({ error: "Scan not found." }, { status: 404 });
  }

  let competitorUrl = parsed.data.competitorUrl.trim();
  if (!/^https?:\/\//i.test(competitorUrl)) {
    competitorUrl = `https://${competitorUrl}`;
  }

  try {
    // Re-fetch our own page fresh rather than trusting stored issues/content,
    // and fetch the competitor's page concurrently.
    const [ourPageResult, competitorPageResult] = await Promise.all([
      fetchPageSafely(scan.finalUrl ?? scan.url),
      fetchPageSafely(competitorUrl),
    ]);

    const ourParsed = parsePage(ourPageResult.html, ourPageResult.finalUrl);
    const { issues: ourIssues } = runAuditRules(ourParsed);

    const competitorParsed = parsePage(competitorPageResult.html, competitorPageResult.finalUrl);
    const { issues: competitorIssues, score: competitorScore } = runAuditRules(competitorParsed);

    const gap = await generateCompetitorGapAnalysis(
      ourParsed,
      ourIssues,
      ourPageResult.finalUrl,
      competitorParsed,
      competitorIssues,
      competitorPageResult.finalUrl
    );

    scan.competitorComparison = {
      competitorUrl,
      competitorFinalUrl: competitorPageResult.finalUrl,
      competitorScore,
      scoreDelta: scan.score - competitorScore,
      ...gap,
    };
    await scan.save();

    return NextResponse.json({ competitorComparison: scan.competitorComparison });
  } catch (err) {
    if (err instanceof AiUnavailableError || err instanceof UnsafeUrlError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    console.error("Competitor comparison failed", err);
    return NextResponse.json({ error: "Could not generate a comparison right now." }, { status: 502 });
  }
}
