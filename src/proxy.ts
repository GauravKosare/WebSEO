import { NextResponse, type NextRequest } from "next/server";
import { VISITOR_COOKIE } from "@/lib/visitor";

/**
 * Issues the anonymous visitor cookie here, in middleware, because Next.js only
 * allows cookie writes from middleware, Route Handlers, or Server Actions —
 * never from a plain Server Component render. Running this for every request
 * guarantees the cookie already exists by the time any page component (e.g.
 * /history, /results/[id]) renders, so those can safely just read it.
 */
export function proxy(req: NextRequest) {
  const existing = req.cookies.get(VISITOR_COOKIE)?.value;
  if (existing) return NextResponse.next();

  const visitorId = crypto.randomUUID();

  // Forward the new id on the *request* headers too, so this same request's
  // Server Components / Route Handlers can read it immediately via
  // cookies().get() instead of only seeing it on the next round trip.
  const requestHeaders = new Headers(req.headers);
  const existingCookieHeader = requestHeaders.get("cookie");
  requestHeaders.set(
    "cookie",
    existingCookieHeader ? `${existingCookieHeader}; ${VISITOR_COOKIE}=${visitorId}` : `${VISITOR_COOKIE}=${visitorId}`
  );

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.cookies.set(VISITOR_COOKIE, visitorId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return res;
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
