import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { Resend } from "resend";
import { renderToBuffer } from "@react-pdf/renderer";
import { connectToDatabase } from "@/lib/db";
import { Scan } from "@/lib/models/Scan";
import { getOrCreateVisitorId } from "@/lib/visitor";
import { getClientIp } from "@/lib/clientIp";
import { AuditReportDocument } from "@/lib/pdf/AuditReportDocument";

export const runtime = "nodejs";
export const maxDuration = 30;

const bodySchema = z.object({ email: z.string().email().max(320) });

// Emailing hits a real external send quota and can be used to spam an
// arbitrary inbox, so this is capped tighter than the read-only report
// download.
const MAX_EMAILS_PER_HOUR = 5;
const recentSendsByKey = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const windowStart = now - 60 * 60 * 1000;
  const timestamps = (recentSendsByKey.get(key) ?? []).filter((t) => t > windowStart);
  if (timestamps.length >= MAX_EMAILS_PER_HOUR) {
    recentSendsByKey.set(key, timestamps);
    return true;
  }
  timestamps.push(now);
  recentSendsByKey.set(key, timestamps);
  return false;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Email delivery isn't configured (missing RESEND_API_KEY)." }, { status: 500 });
  }

  await connectToDatabase();
  const { id: visitorId } = await getOrCreateVisitorId();
  const clientIp = getClientIp(req);

  // This process-memory rate limiter resets on cold start / across
  // serverless instances, which is an acceptable soft limit for a feature
  // that's also capped by Resend's own account-level sending quota.
  if (isRateLimited(visitorId) || (clientIp && isRateLimited(`ip:${clientIp}`))) {
    return NextResponse.json({ error: "Too many report emails sent recently. Please try again later." }, { status: 429 });
  }

  const scan = await Scan.findOne({ _id: id, visitorId }).lean();
  if (!scan) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const buffer = await renderToBuffer(AuditReportDocument({ scan: scan as never }));
    const resend = new Resend(apiKey);
    const fromAddress = process.env.RESEND_FROM_EMAIL || "WebSEO <onboarding@resend.dev>";

    const { error } = await resend.emails.send({
      from: fromAddress,
      to: parsed.data.email,
      subject: `WebSEO report for ${scan.finalUrl ?? scan.url}`,
      text: `Your SEO audit report for ${scan.finalUrl ?? scan.url} (score: ${scan.score}/100) is attached.`,
      attachments: [{ filename: "webseo-report.pdf", content: buffer }],
    });

    if (error) {
      console.error("Resend send failed", error);
      return NextResponse.json({ error: "Could not send the email right now." }, { status: 502 });
    }

    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error("Report email failed", err);
    return NextResponse.json({ error: "Could not send the email right now." }, { status: 502 });
  }
}
