import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

// Use this client inside Server Components, Route Handlers, and Server Actions.
// It reads the user's session from cookies so RLS policies apply correctly
// (auth.uid() resolves to the real signed-in user, not a service role).
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component with no request context to write
            // to — safe to ignore as long as middleware.ts is refreshing the
            // session on every request (it is, see middleware.ts).
          }
        },
      },
    }
  );
}
