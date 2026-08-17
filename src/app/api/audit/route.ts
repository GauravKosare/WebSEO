import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { Scan } from "@/lib/models/Scan";
import { getOrCreateVisitorId } from "@/lib/visitor";
import { fetchPageSafely } from "@/lib/audit/crawler";
import { parsePage } from "@/lib/audit/parsePage";
import { runAuditRules } from "@/lib/audit/rules";
import { getPageSpeedResult } from "@/lib/audit/pagespeed";
import { UnsafeUrlError } from "@/lib/audit/urlSafety";

const bodySchema = z.object({ url: z.string().min(1).max(2048) });

const MAX_SCANS_PER_HOUR = 10;

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid URL is required." }, { status: 400 });
  }

  await connectToDatabase();
  const { id: visitorId } = await getOrCreateVisitorId();

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await Scan.countDocuments({ visitorId, createdAt: { $gte: oneHourAgo } });
  if (recentCount >= MAX_SCANS_PER_HOUR) {
    return NextResponse.json({ error: "Scan limit reached. Please try again later." }, { status: 429 });
  }

  let normalizedUrl = parsed.data.url.trim();
  if (!/^https?:\/\//i.test(normalizedUrl)) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  try {
    const page = await fetchPageSafely(normalizedUrl);
    const parsedPage = parsePage(page.html, page.finalUrl);
    const { issues, score } = runAuditRules(parsedPage);
    const pageSpeed = await getPageSpeedResult(page.finalUrl);

    const scan = await Scan.create({
      visitorId,
      url: normalizedUrl,
      finalUrl: page.finalUrl,
      score,
      issues,
      pageSpeed,
      scoreHistory: [{ score, scannedAt: new Date() }],
    });

    return NextResponse.json({ id: scan._id.toString() }, { status: 201 });
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Audit failed", err);
    return NextResponse.json({ error: "Something went wrong while scanning that URL." }, { status: 502 });
  }
}
