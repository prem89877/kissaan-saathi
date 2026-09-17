"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CodCollectButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    // The enforce_payment_status_transition trigger only allows this exact
    // move (cod_pending -> cod_collected, by the order's own farmer).
    const { error: updateError } = await supabase
      .from("orders")
      .update({ payment_status: "cod_collected" })
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
      <button onClick={handleClick} disabled={loading} className="btn-secondary w-full">
        {loading ? "Saving…" : "Mark Cash on Delivery as collected"}
      </button>
    </div>
  );
}
