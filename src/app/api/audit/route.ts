import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { Scan } from "@/lib/models/Scan";
import { getOrCreateVisitorId } from "@/lib/visitor";
import { getClientIp } from "@/lib/clientIp";
import { fetchPageSafely } from "@/lib/audit/crawler";
import { parsePage } from "@/lib/audit/parsePage";
import { runAuditRules } from "@/lib/audit/rules";
import { getPageSpeedResult } from "@/lib/audit/pagespeed";
import { UnsafeUrlError } from "@/lib/audit/urlSafety";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({ url: z.string().min(1).max(2048) });

const MAX_SCANS_PER_HOUR = 10;

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid URL is required." }, { status: 400 });
  }

  await connectToDatabase();
  const { id: visitorId } = await getOrCreateVisitorId();
  const clientIp = getClientIp(req);

  // Rate-limit by both the visitor cookie and the client IP — clearing
  // cookies alone (the cheapest bypass) still hits the IP-keyed limit.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await Scan.countDocuments({
    createdAt: { $gte: oneHourAgo },
    $or: [{ visitorId }, ...(clientIp ? [{ clientIp }] : [])],
  });
  if (recentCount >= MAX_SCANS_PER_HOUR) {
    return NextResponse.json({ error: "Scan limit reached. Please try again later." }, { status: 429 });
  }

  let normalizedUrl = parsed.data.url.trim();
  if (!/^https?:\/\//i.test(normalizedUrl)) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  try {
    // PageSpeed only needs the URL (Google follows redirects itself), so run
    // it concurrently with our own fetch+parse instead of waiting on it.
    const [page, pageSpeed] = await Promise.all([fetchPageSafely(normalizedUrl), getPageSpeedResult(normalizedUrl)]);
    const parsedPage = parsePage(page.html, page.finalUrl);
    const { issues, score } = runAuditRules(parsedPage);

    const scan = await Scan.create({
      visitorId,
      clientIp,
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
