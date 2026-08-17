import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { Scan } from "@/lib/models/Scan";
import { getOrCreateVisitorId } from "@/lib/visitor";
import { fetchPageSafely } from "@/lib/audit/crawler";
import { parsePage } from "@/lib/audit/parsePage";
import { generateContentSuggestions, AiUnavailableError } from "@/lib/ai/gemini";
import { UnsafeUrlError } from "@/lib/audit/urlSafety";

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

  try {
    // Re-fetch the page rather than storing full HTML, keeping documents small.
    const page = await fetchPageSafely(scan.finalUrl ?? scan.url);
    const parsedPage = parsePage(page.html, page.finalUrl);
    const aiContent = await generateContentSuggestions(parsedPage, scan.issues ?? [], page.finalUrl);

    scan.aiContent = aiContent;
    await scan.save();

    return NextResponse.json({ aiContent });
  } catch (err) {
    if (err instanceof AiUnavailableError || err instanceof UnsafeUrlError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    console.error("AI content generation failed", err);
    return NextResponse.json({ error: "Could not generate AI suggestions right now." }, { status: 502 });
  }
}
