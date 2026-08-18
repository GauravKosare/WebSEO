import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { Scan } from "@/lib/models/Scan";
import { getOrCreateVisitorId } from "@/lib/visitor";
import { checkLinks } from "@/lib/audit/linkChecker";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_LINKS_CHECKED = 20;

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

  const links = (scan.internalLinkUrls ?? []).slice(0, MAX_LINKS_CHECKED);
  if (links.length === 0) {
    return NextResponse.json({ error: "No internal links were found on this page to check." }, { status: 400 });
  }

  const results = await checkLinks(links);
  const brokenCount = results.filter((r) => r.status === "broken" || r.status === "error").length;
  const longRedirectCount = results.filter((r) => r.status === "redirect").length;

  scan.linkCheck = { checkedAt: new Date(), brokenCount, longRedirectCount, results };
  await scan.save();

  return NextResponse.json({ linkCheck: scan.linkCheck });
}
