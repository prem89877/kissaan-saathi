import { createBrowserClient } from "@supabase/ssr";

// Use this client inside Client Components ("use client").
// It only ever holds the public anon key — RLS on the database is what
// actually enforces who can read/write what, never this file.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
