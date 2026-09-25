import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// middleware.ts already calls supabase.auth.getUser() for every single
// request under /farmer, /buyer, /admin and /delivery, and that call is a
// real network round trip to the Supabase Auth server to verify the JWT
// (unlike getSession(), which just reads the local cookie). Before this
// helper existed, every layout AND every page under those routes made that
// exact same call again — 2-3x per navigation — which was the single
// biggest contributor to the 2-4s navigation delay.
//
// middleware.ts now stamps the already-verified user id/role onto the
// request headers (x-user-id, x-user-role) after it finishes verifying.
// Layouts/pages read that header instead of asking the Auth server again.
//
// This is safe: a client cannot forge these headers to impersonate another
// user — middleware unconditionally overwrites them on every matched
// request based on its own server-side verification, before Next.js ever
// renders a layout or page. And nothing downstream trusts the header for
// data access either: every actual read/write still goes through the
// cookie-authenticated Supabase client, so Postgres RLS (auth.uid()) keeps
// enforcing access exactly as before. This only removes a redundant
// "who is this" round trip, not the real authorization check.
export function getAuthContext(): { userId: string | null; role: string | null } {
  const h = headers();
  return {
    userId: h.get("x-user-id"),
    role: h.get("x-user-role"),
  };
}

// Use inside any Server Component (layout or page) under a route middleware
// protects. Falls back to a real supabase.auth.getUser() call only if the
// header is somehow missing (e.g. route protection config changes in the
// future) — so this can never become a security hole, only ever a
// performance optimization on the common path.
export async function requireUserId(): Promise<string> {
  const { userId } = getAuthContext();
  if (userId) return userId;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error(
      "requireUserId() was called on a route with no verified user. " +
      "This route should be covered by middleware.ts's matcher."
    );
  }
  return user.id;
}
