import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { Scan } from "@/lib/models/Scan";
import { getOrCreateVisitorId } from "@/lib/visitor";
import { fetchPageSafely } from "@/lib/audit/crawler";
import { parsePage } from "@/lib/audit/parsePage";
import { generateKeywordIdeas, AiUnavailableError } from "@/lib/ai/gemini";
import { UnsafeUrlError } from "@/lib/audit/urlSafety";

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
    const page = await fetchPageSafely(scan.finalUrl ?? scan.url);
    const parsedPage = parsePage(page.html, page.finalUrl);
    const ideas = await generateKeywordIdeas(parsedPage, page.finalUrl);

    scan.keywordIdeas = ideas;
    await scan.save();

    return NextResponse.json({ keywordIdeas: ideas });
  } catch (err) {
    if (err instanceof AiUnavailableError || err instanceof UnsafeUrlError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    console.error("Keyword generation failed", err);
    return NextResponse.json({ error: "Could not generate keyword ideas right now." }, { status: 502 });
  }
}
