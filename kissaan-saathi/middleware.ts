import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// This runs on every request. It does two jobs:
// 1. Refreshes the Supabase auth session (required by @supabase/ssr).
// 2. Blocks access to /farmer, /buyer, /admin routes unless the signed-in
//    user's profile role actually matches — a farmer typing /admin/dashboard
//    into the URL bar gets redirected, not let through. This is a UX guard
//    only; the real enforcement is Postgres RLS (frontend routes can always
//    be bypassed by a determined attacker calling the API directly).
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string;value: string;options: CookieOptions } []) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
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
    
    const expectedRole = matchedPrefix.slice(1); // "farmer" | "buyer" | "admin"
    
    if (!profile || profile.is_suspended) {
      return NextResponse.redirect(new URL("/login?suspended=1", request.url));
    }
    
    if (profile.role !== expectedRole) {
      // Signed in, but wrong role for this section — send them to their own home.
      return NextResponse.redirect(new URL(`/${profile.role}/dashboard`, request.url));
    }
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