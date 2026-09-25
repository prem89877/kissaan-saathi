"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton({ className, children }: { className?: string; children?: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    if (loading) return; // guard against an accidental double-tap
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    // Only one navigation call needed: /login is itself a fully dynamic
    // route (reads cookies on every request), so router.push already gets
    // a fresh, signed-out render — a follow-up router.refresh() was just a
    // second redundant round trip.
    router.push("/login");
  }

  return (
    <button onClick={handleSignOut} disabled={loading} className={className ?? "text-sm text-soil/70 underline disabled:opacity-50"}>
      {loading ? "Logging out…" : children ?? "Log out"}
    </button>
  );
}
