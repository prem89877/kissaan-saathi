import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LoginForm from "@/components/LoginForm";

// Mirrors the same check on app/page.tsx: if this device already has a
// valid session (the common case when the PWA is reopened after being
// swiped away), skip the login form entirely instead of making the user
// type their password again. `next`/`suspended` query params are preserved
// so a mid-session redirect from middleware.ts still lands correctly.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; suspended?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && searchParams.suspended !== "1") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role) {
      redirect(searchParams.next || `/${profile.role}/dashboard`);
    }
  }

  return <LoginForm />;
}
