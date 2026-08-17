import type { NextRequest } from "next/server";

/** Best-effort client IP from platform-set proxy headers (Vercel sets x-forwarded-for). Spoofable off-platform, but combined with the visitor cookie it raises the bar past "just clear cookies" for casual abuse. */
export function getClientIp(req: NextRequest): string | null {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return null;
}
