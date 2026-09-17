"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SuspendToggleButton({
  userId,
  isSuspended,
}: {
  userId: string;
  isSuspended: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ is_suspended: !isSuspended })
      .eq("id", userId);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    await supabase.from("admin_actions").insert({
      admin_id: user!.id,
      action: isSuspended ? "user_reactivated" : "user_suspended",
      target_table: "profiles",
      target_id: userId,
    });

    setLoading(false);
    router.refresh();
  }

  return (
    <div>
      {error && <p className="text-alert text-xs">{error}</p>}
      <button
        onClick={handleClick}
        disabled={loading}
        className={isSuspended ? "btn-primary text-sm py-2 px-3 min-h-0" : "btn-secondary border-alert text-alert text-sm py-2 px-3 min-h-0"}
      >
        {loading ? "…" : isSuspended ? "Reactivate" : "Suspend"}
      </button>
    </div>
  );
}
