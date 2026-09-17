"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function OrderStatusButton({
  orderId,
  targetStatus,
  label,
  variant = "primary",
}: {
  orderId: string;
  targetStatus: string;
  label: string;
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    // The enforce_order_transition trigger (Phase 1) is the real gatekeeper —
    // it rejects this update outright if targetStatus isn't a valid next step.
    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: targetStatus })
      .eq("id", orderId);

    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      {error && <p className="text-alert text-sm mb-2">{error}</p>}
      <button
        onClick={handleClick}
        disabled={loading}
        className={variant === "primary" ? "btn-primary w-full" : "btn-secondary w-full"}
      >
        {loading ? "Saving…" : label}
      </button>
    </div>
  );
}
