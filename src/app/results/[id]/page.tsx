import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Scan } from "@/lib/models/Scan";
import { getOrCreateVisitorId } from "@/lib/visitor";
import ResultsClient, { type ScanData } from "./ResultsClient";

export const dynamic = "force-dynamic";

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) notFound();

  await connectToDatabase();
  const { id: visitorId } = await getOrCreateVisitorId();

  const scan = await Scan.findOne({ _id: id, visitorId }).lean();
  if (!scan) notFound();

  const data: ScanData = JSON.parse(JSON.stringify(scan));
  return <ResultsClient initialScan={data} />;
}
