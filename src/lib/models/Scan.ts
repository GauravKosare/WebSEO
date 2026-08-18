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

// Wrapped in a real Schema (not a plain nested object literal) so the whole
// field defaults to `undefined` when unset, matching aiContent/seoStrategy —
// a plain object literal here would get auto-vivified by Mongoose into an
// object with an empty `results: []`, making "not checked yet" indistinguishable
// from "checked, zero results" via a truthy check.
const LinkCheckSchema = new Schema(
  {
    checkedAt: Date,
    brokenCount: Number,
    longRedirectCount: Number,
    results: [
      {
        url: String,
        status: { type: String, enum: ["ok", "broken", "redirect", "error"] },
        statusCode: Number,
        redirectCount: Number,
        finalUrl: String,
        _id: false,
      },
    ],
  },
  { _id: false }
);

const CompetitorComparisonSchema = new Schema(
  {
    competitorUrl: String,
    competitorFinalUrl: String,
    competitorScore: Number,
    scoreDelta: Number,
    gapAnalysis: String,
    competitorAdvantages: [String],
    ourAdvantages: [String],
    keywordGaps: [String],
  },
  { _id: false }
);

// Also a real Schema: parsePage's readability can be explicitly null (not
// enough text on the page), and a plain nested-object path doesn't store an
// explicit null cleanly.
const ReadabilitySchema = new Schema(
  {
    fleschScore: Number,
    gradeLevel: String,
    sentenceCount: Number,
    wordCount: Number,
    avgWordsPerSentence: Number,
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
    readability: ReadabilitySchema,
    internalLinkUrls: [String],
    linkCheck: LinkCheckSchema,
    competitorComparison: CompetitorComparisonSchema,
    monitoringEnabled: { type: Boolean, default: false },
    scoreHistory: [{ score: Number, scannedAt: Date, _id: false }],
  },
  { timestamps: true }
);

ScanSchema.index({ visitorId: 1, createdAt: -1 });

export type ScanDocument = InferSchemaType<typeof ScanSchema>;

export const Scan = mongoose.models.Scan ?? mongoose.model("Scan", ScanSchema);
