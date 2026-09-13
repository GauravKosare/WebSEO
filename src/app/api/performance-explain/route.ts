import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { Scan } from "@/lib/models/Scan";
import { getOrCreateVisitorId } from "@/lib/visitor";
import { explainPerformanceOpportunities, AiUnavailableError } from "@/lib/ai/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({ scanId: z.string() });

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !mongoose.isValidObjectId(parsed.data.scanId)) {
    return NextResponse.json({ error: "A valid scanId is required." }, { status: 400 });
  }

  await connectToDatabase();
  const { id: visitorId } = await getOrCreateVisitorId();

  const scan = await Scan.findOne({ _id: parsed.data.scanId, visitorId });
  if (!scan) {
    return NextResponse.json({ error: "Scan not found." }, { status: 404 });
  }

  const opportunities = scan.pageSpeed?.opportunities ?? [];

  try {
    // The opportunities are already stored from the original PageSpeed
    // call — no need to re-fetch the page or re-run PageSpeed for this.
    const explanation = await explainPerformanceOpportunities(opportunities, scan.finalUrl ?? scan.url, scan.pageSpeed?.performanceScore ?? null);

    scan.performanceExplanation = explanation;
    await scan.save();

    return NextResponse.json({ performanceExplanation: explanation });
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    console.error("Performance explanation failed", err);
    return NextResponse.json({ error: "Could not explain performance results right now." }, { status: 502 });
  }
}
