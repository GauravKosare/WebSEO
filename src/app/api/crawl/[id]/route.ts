import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { SiteCrawl } from "@/lib/models/SiteCrawl";
import { getOrCreateVisitorId } from "@/lib/visitor";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await connectToDatabase();
  const { id: visitorId } = await getOrCreateVisitorId();

  const crawl = await SiteCrawl.findOne({ _id: id, visitorId }).lean();
  if (!crawl) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json(crawl);
}
