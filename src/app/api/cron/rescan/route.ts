import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Scan } from "@/lib/models/Scan";
import { fetchPageSafely } from "@/lib/audit/crawler";
import { parsePage } from "@/lib/audit/parsePage";
import { runAuditRules } from "@/lib/audit/rules";
import { getPageSpeedResult } from "@/lib/audit/pagespeed";
import { UnsafeUrlError } from "@/lib/audit/urlSafety";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_HISTORY_ENTRIES = 90;
const CANDIDATE_POOL = 300;
// Leaves headroom under maxDuration for the in-flight site's own request to
// finish and for the response to be written, instead of racing the platform's
// hard kill.
const TIME_BUDGET_MS = 50_000;

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

  // Oldest-scanned-first so that if there are more monitored sites than fit
  // in one run's time budget, everyone still gets covered over successive
  // runs instead of the same early sites winning every time.
  const monitored = await Scan.find({ monitoringEnabled: true })
    .sort({ updatedAt: 1 })
    .limit(CANDIDATE_POOL);

  // Only rescan the most recent scan per unique (visitorId, url) pair.
  const seen = new Set<string>();
  const targets = monitored.filter((scan) => {
    const key = `${scan.visitorId}:${scan.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const results: { url: string; status: "ok" | "error"; score?: number; error?: string }[] = [];
  const start = Date.now();
  let skippedForTime = 0;

  for (const scan of targets) {
    if (Date.now() - start > TIME_BUDGET_MS) {
      skippedForTime = targets.length - results.length;
      break;
    }

    try {
      const [page, pageSpeed] = await Promise.all([fetchPageSafely(scan.url), getPageSpeedResult(scan.url)]);
      const parsedPage = parsePage(page.html, page.finalUrl);
      const { score } = runAuditRules(parsedPage);

      scan.score = score;
      scan.finalUrl = page.finalUrl;
      scan.pageSpeed = pageSpeed;
      scan.scoreHistory = [...(scan.scoreHistory ?? []), { score, scannedAt: new Date() }].slice(-MAX_HISTORY_ENTRIES);
      await scan.save();

      results.push({ url: scan.url, status: "ok", score });
    } catch (err) {
      // Still touch updatedAt so a persistently-failing site doesn't starve
      // the rest of the rotation by always sorting first.
      await scan.save().catch(() => {});
      results.push({
        url: scan.url,
        status: "error",
        error: err instanceof UnsafeUrlError ? err.message : "Rescan failed.",
      });
    }
  }

  return NextResponse.json({ rescanned: results.length, skippedForTime, results });
}
