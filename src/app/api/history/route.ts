import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Scan } from "@/lib/models/Scan";
import { getOrCreateVisitorId } from "@/lib/visitor";

export async function GET() {
  await connectToDatabase();
  const { id: visitorId } = await getOrCreateVisitorId();

  const scans = await Scan.find({ visitorId })
    .sort({ createdAt: -1 })
    .limit(50)
    .select({ url: 1, finalUrl: 1, score: 1, createdAt: 1, monitoringEnabled: 1 })
    .lean();

  return NextResponse.json({ scans });
}
