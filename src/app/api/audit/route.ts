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
import { getDomainAuthority } from "@/lib/audit/domainAuthority";
import { analyzeSecurityHeaders } from "@/lib/audit/securityHeaders";
import { checkSafeBrowsing } from "@/lib/audit/safeBrowsing";
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
    // None of these depend on each other's results, so run them all
    // concurrently instead of waiting on each in turn.
    const [page, pageSpeed, domainAuthority, safeBrowsing] = await Promise.all([
      fetchPageSafely(normalizedUrl),
      getPageSpeedResult(normalizedUrl),
      getDomainAuthority(normalizedUrl),
      checkSafeBrowsing(normalizedUrl),
    ]);
    const parsedPage = parsePage(page.html, page.finalUrl);
    const { issues, score } = runAuditRules(parsedPage);
    const securityHeaders = analyzeSecurityHeaders(page.headers, page.finalUrl);

    // A malware/phishing flag is a dominant, safety-critical signal — it
    // should crater the score and lead the issue list, not sit as a
    // side-note next to "meta description is short".
    if (safeBrowsing.isFlagged) {
      issues.unshift({
        id: "safe-browsing-flagged",
        severity: "critical",
        category: "Security",
        title: "Flagged by Google Safe Browsing",
        detail: `Google has flagged this site for: ${safeBrowsing.threatTypes.join(", ") || "unspecified threats"}. This will actively block visitors in Chrome/Firefox and tank rankings until resolved.`,
        points: 40,
      });
    }
    const finalScore = safeBrowsing.isFlagged ? Math.max(0, score - 40) : score;

    const scan = await Scan.create({
      visitorId,
      clientIp,
      url: normalizedUrl,
      finalUrl: page.finalUrl,
      score: finalScore,
      issues,
      pageSpeed,
      domainAuthority,
      securityHeaders,
      safeBrowsing,
      readability: parsedPage.readability,
      localSeo: parsedPage.localSeo,
      internalLinkUrls: parsedPage.internalLinkUrls,
      scoreHistory: [
        { score: finalScore, performanceScore: pageSpeed.performanceScore, accessibilityScore: pageSpeed.accessibilityScore, scannedAt: new Date() },
      ],
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
