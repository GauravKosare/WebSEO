import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
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

function parseFromAddress(raw: string): { name?: string; email: string } {
  // Accepts either "Name <email@x.com>" or a bare "email@x.com".
  const match = raw.match(/^(.*)<(.+)>$/);
  if (match) return { name: match[1].trim().replace(/^"|"$/g, "") || undefined, email: match[2].trim() };
  return { email: raw.trim() };
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

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Email delivery isn't configured (missing BREVO_API_KEY)." }, { status: 500 });
  }
  const fromRaw = process.env.BREVO_FROM_EMAIL;
  if (!fromRaw) {
    return NextResponse.json({ error: "Email delivery isn't configured (missing BREVO_FROM_EMAIL)." }, { status: 500 });
  }

  await connectToDatabase();
  const { id: visitorId } = await getOrCreateVisitorId();
  const clientIp = getClientIp(req);

  // This process-memory rate limiter resets on cold start / across
  // serverless instances, which is an acceptable soft limit for a feature
  // that's also capped by Brevo's own account-level sending quota.
  if (isRateLimited(visitorId) || (clientIp && isRateLimited(`ip:${clientIp}`))) {
    return NextResponse.json({ error: "Too many report emails sent recently. Please try again later." }, { status: 429 });
  }

  const scan = await Scan.findOne({ _id: id, visitorId }).lean();
  if (!scan) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const buffer = await renderToBuffer(AuditReportDocument({ scan: scan as never }));
    const sender = parseFromAddress(fromRaw);
    const pageLabel = scan.finalUrl ?? scan.url;

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: { name: sender.name ?? "WebSEO", email: sender.email },
        to: [{ email: parsed.data.email }],
        subject: `WebSEO report for ${pageLabel}`,
        textContent: `Your SEO audit report for ${pageLabel} (score: ${scan.score}/100) is attached.`,
        attachment: [{ content: buffer.toString("base64"), name: "webseo-report.pdf" }],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("Brevo send failed", res.status, body.slice(0, 500));
      return NextResponse.json({ error: "Could not send the email right now." }, { status: 502 });
    }

    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error("Report email failed", err);
    return NextResponse.json({ error: "Could not send the email right now." }, { status: 502 });
  }
}
