import mongoose, { Schema, type InferSchemaType } from "mongoose";

const CrawledPageSchema = new Schema(
  {
    url: String,
    finalUrl: String,
    score: Number,
    issueCount: Number,
    criticalIssueCount: Number,
    topIssues: [String],
    status: { type: String, enum: ["ok", "error"] },
    error: String,
  },
  { _id: false }
);

const SiteCrawlSchema = new Schema(
  {
    visitorId: { type: String, required: true, index: true },
    clientIp: { type: String, index: true },
    rootUrl: { type: String, required: true },
    sitemapUrl: String,
    totalUrlsFound: Number,
    pages: [CrawledPageSchema],
    overallScore: Number,
    skippedForTime: { type: Number, default: 0 },
    validationIssues: [
      {
        severity: { type: String, enum: ["critical", "warning", "info"] },
        title: String,
        detail: String,
        _id: false,
      },
    ],
  },
  { timestamps: true }
);

SiteCrawlSchema.index({ visitorId: 1, createdAt: -1 });

export type SiteCrawlDocument = InferSchemaType<typeof SiteCrawlSchema>;

export const SiteCrawl = mongoose.models.SiteCrawl ?? mongoose.model("SiteCrawl", SiteCrawlSchema);
