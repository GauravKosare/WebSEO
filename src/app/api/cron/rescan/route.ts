import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Scan } from "@/lib/models/Scan";
import { fetchPageSafely } from "@/lib/audit/crawler";
import { parsePage } from "@/lib/audit/parsePage";
import { runAuditRules } from "@/lib/audit/rules";
import { getPageSpeedResult } from "@/lib/audit/pagespeed";
import { UnsafeUrlError } from "@/lib/audit/urlSafety";

const MAX_HISTORY_ENTRIES = 90;

// Vercel Cron calls this on a schedule (see vercel.json). Any other caller
// must present the shared secret, so this can't be triggered by outsiders
// to spray requests at arbitrary sites via our server.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured." }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  await connectToDatabase();

  const monitored = await Scan.find({ monitoringEnabled: true })
    .sort({ createdAt: -1 })
    .limit(200);

  // Only rescan the most recent scan per unique (visitorId, url) pair.
  const seen = new Set<string>();
  const targets = monitored.filter((scan) => {
    const key = `${scan.visitorId}:${scan.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const results: { url: string; status: "ok" | "error"; score?: number; error?: string }[] = [];

  for (const scan of targets) {
    try {
      const page = await fetchPageSafely(scan.url);
      const parsedPage = parsePage(page.html, page.finalUrl);
      const { score } = runAuditRules(parsedPage);
      const pageSpeed = await getPageSpeedResult(page.finalUrl);

      scan.score = score;
      scan.finalUrl = page.finalUrl;
      scan.pageSpeed = pageSpeed;
      scan.scoreHistory = [...(scan.scoreHistory ?? []), { score, scannedAt: new Date() }].slice(-MAX_HISTORY_ENTRIES);
      await scan.save();

      results.push({ url: scan.url, status: "ok", score });
    } catch (err) {
      results.push({
        url: scan.url,
        status: "error",
        error: err instanceof UnsafeUrlError ? err.message : "Rescan failed.",
      });
    }
  }

  return NextResponse.json({ rescanned: results.length, results });
}
