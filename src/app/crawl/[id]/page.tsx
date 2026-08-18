import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { SiteCrawl } from "@/lib/models/SiteCrawl";
import { getOrCreateVisitorId } from "@/lib/visitor";
import CrawlResultsClient, { type CrawlData } from "./CrawlResultsClient";

export const dynamic = "force-dynamic";

export default async function CrawlResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) notFound();

  await connectToDatabase();
  const { id: visitorId } = await getOrCreateVisitorId();

  const crawl = await SiteCrawl.findOne({ _id: id, visitorId }).lean();
  if (!crawl) notFound();

  const data: CrawlData = JSON.parse(JSON.stringify(crawl));
  return <CrawlResultsClient crawl={data} />;
}
