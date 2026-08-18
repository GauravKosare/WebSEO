import type { CheerioAPI } from "cheerio";

const LOCAL_BUSINESS_TYPES = [
  "localbusiness",
  "restaurant",
  "store",
  "professionalservice",
  "medicalbusiness",
  "attorney",
  "dentist",
  "physician",
  "realestateagent",
  "autorepair",
  "hairsalon",
  "homeandconstructionbusiness",
  "lodgingbusiness",
  "foodestablishment",
];

// Requires an actual separator between digit groups (space/dot/dash/parens) —
// without that, this would match any bare 7-10 digit run (stats, IDs, years
// glued to other numbers), which is common noise on non-local-business pages.
const PHONE_PATTERN = /(?:\+?\d{1,3}[\s.-])?\(?\d{2,4}\)?[\s.-]\d{3,4}[\s.-]?\d{3,4}\b/;
const ADDRESS_HINT_PATTERN = /\b\d{1,6}\s+[A-Za-z0-9.'\s]{2,40}\s+(street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|way|suite|ste)\b/i;
const HOURS_PATTERN = /\b(mon|monday|tue|tuesday|wed|wednesday|thu|thursday|fri|friday|sat|saturday|sun|sunday)\b.{0,20}(-|to|–).{0,20}\b(am|pm|\d{1,2}:\d{2})\b/i;

export type LocalSeoSignals = {
  structuredDataTypes: string[];
  hasLocalBusinessSchema: boolean;
  hasPhoneNumber: boolean;
  hasAddressPattern: boolean;
  hasEmbeddedMap: boolean;
  hasHoursText: boolean;
};

function collectSchemaTypes($: CheerioAPI): string[] {
  const types: string[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    collectTypesFromNode(parsed, types);
  });

  return types;
}

function collectTypesFromNode(node: unknown, types: string[]): void {
  if (Array.isArray(node)) {
    for (const item of node) collectTypesFromNode(item, types);
    return;
  }
  if (!node || typeof node !== "object") return;

  const obj = node as Record<string, unknown>;
  if (typeof obj["@type"] === "string") types.push(obj["@type"]);
  else if (Array.isArray(obj["@type"])) types.push(...obj["@type"].filter((t): t is string => typeof t === "string"));

  if (Array.isArray(obj["@graph"])) {
    for (const item of obj["@graph"]) collectTypesFromNode(item, types);
  }
}

/**
 * Purely on-page heuristics (no external API — there's no way to check a
 * real Google Business Profile without OAuth into that specific business's
 * account). This surfaces whether the page carries the signals search
 * engines associate with a physical/local business, for sites where that's
 * relevant.
 */
export function analyzeLocalSeo($: CheerioAPI, bodyText: string): LocalSeoSignals {
  const structuredDataTypes = Array.from(new Set(collectSchemaTypes($)));
  const hasLocalBusinessSchema = structuredDataTypes.some((t) => LOCAL_BUSINESS_TYPES.includes(t.toLowerCase()));

  const hasPhoneNumber = PHONE_PATTERN.test(bodyText) || $('a[href^="tel:"]').length > 0;
  const hasAddressPattern = ADDRESS_HINT_PATTERN.test(bodyText) || $("address").length > 0;
  const hasEmbeddedMap = $('iframe[src*="maps.google"], iframe[src*="google.com/maps"]').length > 0;
  const hasHoursText = HOURS_PATTERN.test(bodyText);

  return { structuredDataTypes, hasLocalBusinessSchema, hasPhoneNumber, hasAddressPattern, hasEmbeddedMap, hasHoursText };
}
