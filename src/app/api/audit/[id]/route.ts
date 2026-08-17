import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Scan } from "@/lib/models/Scan";
import { getOrCreateVisitorId } from "@/lib/visitor";

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

  return NextResponse.json(scan);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (typeof body?.monitoringEnabled !== "boolean") {
    return NextResponse.json({ error: "monitoringEnabled (boolean) is required." }, { status: 400 });
  }

  await connectToDatabase();
  const { id: visitorId } = await getOrCreateVisitorId();

  const scan = await Scan.findOneAndUpdate(
    { _id: id, visitorId },
    { monitoringEnabled: body.monitoringEnabled },
    { new: true }
  ).lean();

  if (!scan) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json(scan);
}
