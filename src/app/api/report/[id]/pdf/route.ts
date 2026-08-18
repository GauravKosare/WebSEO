import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { renderToBuffer } from "@react-pdf/renderer";
import { connectToDatabase } from "@/lib/db";
import { Scan } from "@/lib/models/Scan";
import { getOrCreateVisitorId } from "@/lib/visitor";
import { AuditReportDocument } from "@/lib/pdf/AuditReportDocument";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await connectToDatabase();
  const { id: visitorId } = await getOrCreateVisitorId();

  const scan = await Scan.findOne({ _id: id, visitorId }).lean();
  if (!scan) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const buffer = await renderToBuffer(AuditReportDocument({ scan: scan as never }));

  const host = (scan.finalUrl ?? scan.url)
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9.-]/gi, "-")
    .replace(/-+$/, "");

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="webseo-report-${host}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
