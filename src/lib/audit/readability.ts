export type ReadabilityResult = {
  fleschScore: number;
  gradeLevel: string;
  sentenceCount: number;
  wordCount: number;
  avgWordsPerSentence: number;
};

const VOWEL_GROUPS = /[aeiouy]+/g;

/** Heuristic syllable counter (no dictionary lookup) — standard approach used by most readability tools: count vowel-group clusters, with common English exceptions. */
function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;

  let normalized = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  normalized = normalized.replace(/^y/, "");
  const matches = normalized.match(VOWEL_GROUPS);
  return Math.max(1, matches ? matches.length : 1);
}

function splitSentences(text: string): string[] {
  return text
    .split(/[.!?]+(?:\s|$)/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).filter(Boolean).length >= 2); // drop fragments/labels
}

function gradeLevelFromScore(score: number): string {
  if (score >= 90) return "Very easy (5th grade)";
  if (score >= 80) return "Easy (6th grade)";
  if (score >= 70) return "Fairly easy (7th grade)";
  if (score >= 60) return "Standard (8th-9th grade)";
  if (score >= 50) return "Fairly difficult (10th-12th grade)";
  if (score >= 30) return "Difficult (college level)";
  return "Very difficult (college graduate)";
}

/**
 * Flesch Reading Ease over the page's visible text. Needs a real sample (not
 * just the 4000-char truncated textSample used elsewhere) so scores aren't
 * skewed by where the truncation happened to land — callers should pass the
 * fuller body text.
 */
export function computeReadability(bodyText: string): ReadabilityResult | null {
  const sentences = splitSentences(bodyText);
  const words = bodyText.split(/\s+/).filter(Boolean);

  if (sentences.length === 0 || words.length < 30) {
    return null; // not enough text to produce a meaningful score
  }

  const syllableCount = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const wordCount = words.length;
  const sentenceCount = sentences.length;

  const score = 206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (syllableCount / wordCount);
  const fleschScore = Math.max(0, Math.min(100, Math.round(score * 10) / 10));

  return {
    fleschScore,
    gradeLevel: gradeLevelFromScore(fleschScore),
    sentenceCount,
    wordCount,
    avgWordsPerSentence: Math.round((wordCount / sentenceCount) * 10) / 10,
  };
}
