import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

const VISITOR_COOKIE = "webseo_visitor_id";

/** Anonymous per-browser id (no login), used to group scan history. Not a security boundary. */
export async function getOrCreateVisitorId(): Promise<{ id: string; isNew: boolean }> {
  const store = await cookies();
  const existing = store.get(VISITOR_COOKIE)?.value;
  if (existing) return { id: existing, isNew: false };

  const id = randomUUID();
  store.set(VISITOR_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return { id, isNew: true };
}

export { VISITOR_COOKIE };
