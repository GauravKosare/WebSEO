import mongoose, { Schema, type InferSchemaType } from "mongoose";

const IssueSchema = new Schema(
  {
    id: String,
    severity: { type: String, enum: ["critical", "warning", "info"] },
    category: String,
    title: String,
    detail: String,
    points: Number,
  },
  { _id: false }
);

const AiContentSchema = new Schema(
  {
    title: String,
    titleRationale: String,
    metaDescription: String,
    h1: String,
    altTextSuggestions: [{ forImageSrc: String, suggestedAlt: String, _id: false }],
    eeatRecommendations: [String],
    summary: String,
  },
  { _id: false }
);

const KeywordIdeaSchema = new Schema(
  {
    keyword: String,
    intent: String,
    funnelStage: String,
    keywordType: String,
    estimatedDifficulty: String,
    reason: String,
  },
  { _id: false }
);

const SeoStrategySchema = new Schema(
  {
    primaryKeyword: String,
    searchIntent: String,
    contentGapAnalysis: String,
    recommendedHeadingOutline: [{ level: String, text: String, _id: false }],
    recommendedWordCount: Number,
    internalLinkingIdeas: [String],
    schemaMarkupSuggestions: [String],
  },
  { _id: false }
);

const ScanSchema = new Schema(
  {
    visitorId: { type: String, required: true, index: true },
    clientIp: { type: String, index: true },
    url: { type: String, required: true },
    finalUrl: String,
    score: { type: Number, required: true },
    issues: [IssueSchema],
    pageSpeed: {
      performanceScore: Number,
      seoScore: Number,
      accessibilityScore: Number,
      isMobileFriendly: Boolean,
      error: String,
    },
    aiContent: AiContentSchema,
    keywordIdeas: [KeywordIdeaSchema],
    seoStrategy: SeoStrategySchema,
    monitoringEnabled: { type: Boolean, default: false },
    scoreHistory: [{ score: Number, scannedAt: Date, _id: false }],
  },
  { timestamps: true }
);

ScanSchema.index({ visitorId: 1, createdAt: -1 });

export type ScanDocument = InferSchemaType<typeof ScanSchema>;

export const Scan = mongoose.models.Scan ?? mongoose.model("Scan", ScanSchema);
