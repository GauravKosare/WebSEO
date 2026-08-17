import { cookies } from "next/headers";

const VISITOR_COOKIE = "webseo_visitor_id";

/**
 * Reads the anonymous per-browser id used to group scan history (no login).
 * The cookie itself is issued by middleware.ts (the only place allowed to set
 * cookies ahead of every Server Component render) — by the time this runs,
 * the cookie is guaranteed to exist.
 */
export async function getOrCreateVisitorId(): Promise<{ id: string }> {
  const store = await cookies();
  const id = store.get(VISITOR_COOKIE)?.value;
  if (!id) {
    throw new Error("Visitor cookie missing — middleware should have set it for every request.");
  }
  return { id };
}

export { VISITOR_COOKIE };
