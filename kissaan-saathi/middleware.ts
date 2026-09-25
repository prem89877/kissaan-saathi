import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// This runs on every request. It does three jobs:
// 1. Refreshes the Supabase auth session (required by @supabase/ssr).
// 2. Blocks access to /farmer, /buyer, /admin, /delivery routes unless the
//    signed-in user's profile role actually matches — a farmer typing
//    /admin/dashboard into the URL bar gets redirected, not let through.
//    This is a UX guard only; the real enforcement is Postgres RLS
//    (frontend routes can always be bypassed by a determined attacker
//    calling the API directly).
// 3. Stamps the user id/role it just verified onto outgoing REQUEST headers
//    (x-user-id, x-user-role) so the layout and page below it can read
//    "who is this" for free instead of calling supabase.auth.getUser()
//    again themselves. That call is a real network round trip to the Auth
//    server (unlike getSession(), which just reads the cookie), and doing
//    it once in middleware plus again in the layout plus again in the page
//    — on every single navigation — was the main cause of the 2-4s delay.
//    A client cannot spoof these headers: whatever a request arrives with
//    is irrelevant, because this function always overwrites them below
//    based on its own server-side verification, before Next.js renders
//    anything downstream.
export async function middleware(request: NextRequest) {
  // A mutable copy of the incoming request headers. We only ever ADD to
  // this (x-user-id / x-user-role, once verified below) — nothing a client
  // sends is trusted or forwarded unmodified for those two keys.
  const requestHeaders = new Headers(request.headers);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const protectedPrefixes = ["/farmer", "/buyer", "/admin", "/delivery"];
  const matchedPrefix = protectedPrefixes.find((p) => path.startsWith(p));

  if (matchedPrefix) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", path);
      return NextResponse.redirect(loginUrl);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_suspended")
      .eq("id", user.id)
      .single();

    const expectedRole = matchedPrefix.slice(1); // "farmer" | "buyer" | "admin" | "delivery"

    if (!profile || profile.is_suspended) {
      return NextResponse.redirect(new URL("/login?suspended=1", request.url));
    }

    if (profile.role !== expectedRole) {
      // Signed in, but wrong role for this section — send them to their own home.
      return NextResponse.redirect(new URL(`/${profile.role}/dashboard`, request.url));
    }

    // Verified — stamp the headers, then rebuild the response so the new
    // request headers are picked up, while carrying over any session-
    // refresh cookies the setAll callback above already queued.
    requestHeaders.set("x-user-id", user.id);
    requestHeaders.set("x-user-role", profile.role);

    const cookiesToCarry = response.cookies.getAll();
    response = NextResponse.next({ request: { headers: requestHeaders } });
    cookiesToCarry.forEach((c) => response.cookies.set(c));
  }

  return response;
}

export const config = {
  matcher: [
    "/farmer/:path*",
    "/buyer/:path*",
    "/admin/:path*",
    "/delivery/:path*",
  ],
};
