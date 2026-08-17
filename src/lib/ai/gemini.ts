import type { Issue } from "../audit/rules";
import type { ParsedPage } from "../audit/parsePage";

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export class AiUnavailableError extends Error {}

async function callGemini(prompt: string, responseSchema: object): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AiUnavailableError("AI features are not configured (missing GEMINI_API_KEY).");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.4,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new AiUnavailableError(`Gemini API error ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new AiUnavailableError("Gemini returned an empty response.");
    return JSON.parse(text);
  } catch (err) {
    if (err instanceof AiUnavailableError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new AiUnavailableError("The AI request timed out.");
    }
    throw new AiUnavailableError("Could not reach the AI service.");
  } finally {
    clearTimeout(timeout);
  }
}

export type AiContentSuggestions = {
  title: string;
  metaDescription: string;
  h1: string;
  altTextSuggestions: { forImageSrc: string; suggestedAlt: string }[];
  summary: string;
};

export async function generateContentSuggestions(page: ParsedPage, issues: Issue[], pageUrl: string): Promise<AiContentSuggestions> {
  const missingAltImages = page.images.filter((img) => !img.alt).slice(0, 5);

  const prompt = `You are an SEO copywriter. Given this page's current data, suggest improved, natural, non-spammy SEO content.
Page URL: ${pageUrl}
Current title: ${page.title ?? "(none)"}
Current meta description: ${page.metaDescription ?? "(none)"}
Current H1: ${page.h1s[0] ?? "(none)"}
Detected issues: ${issues.map((i) => i.title).join(", ") || "none"}
Visible text sample (truncated): ${page.textSample.slice(0, 1500)}
Images missing alt text (src): ${missingAltImages.map((i) => i.src).join(", ") || "none"}

Return a concise, specific, non-generic recommendation for each field. Do not invent facts not implied by the text sample.`;

  const schema = {
    type: "object",
    properties: {
      title: { type: "string" },
      metaDescription: { type: "string" },
      h1: { type: "string" },
      altTextSuggestions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            forImageSrc: { type: "string" },
            suggestedAlt: { type: "string" },
          },
          required: ["forImageSrc", "suggestedAlt"],
        },
      },
      summary: { type: "string" },
    },
    required: ["title", "metaDescription", "h1", "altTextSuggestions", "summary"],
  };

  return (await callGemini(prompt, schema)) as AiContentSuggestions;
}

export type KeywordIdea = {
  keyword: string;
  intent: "informational" | "navigational" | "transactional" | "commercial";
  estimatedDifficulty: "low" | "medium" | "high";
  reason: string;
};

export async function generateKeywordIdeas(page: ParsedPage, pageUrl: string): Promise<KeywordIdea[]> {
  const prompt = `You are an SEO strategist. Based on this page's content, suggest 8 realistic target keyword/topic ideas a small business could pursue.
These are AI estimates, not real search-volume data, so be conservative and clearly reasoned.
Page URL: ${pageUrl}
Title: ${page.title ?? "(none)"}
Text sample: ${page.textSample.slice(0, 2000)}

For each keyword give an estimated difficulty (low/medium/high) based on how competitive/generic the phrase seems, the likely search intent, and a one-sentence reason it fits this page.`;

  const schema = {
    type: "object",
    properties: {
      ideas: {
        type: "array",
        items: {
          type: "object",
          properties: {
            keyword: { type: "string" },
            intent: { type: "string", enum: ["informational", "navigational", "transactional", "commercial"] },
            estimatedDifficulty: { type: "string", enum: ["low", "medium", "high"] },
            reason: { type: "string" },
          },
          required: ["keyword", "intent", "estimatedDifficulty", "reason"],
        },
      },
    },
    required: ["ideas"],
  };

  const result = (await callGemini(prompt, schema)) as { ideas: KeywordIdea[] };
  return result.ideas;
}
