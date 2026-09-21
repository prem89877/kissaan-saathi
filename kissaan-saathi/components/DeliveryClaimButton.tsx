"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Claims an unassigned, ready-for-pickup order for the signed-in delivery
// partner. This does NOT change order.status — it only sets
// delivery_partner_id, so the enforce_order_transition trigger never runs
// (old.status === new.status). Access is governed entirely by the
// orders_update_delivery RLS policy: it only allows this write when the
// row is currently unassigned, status = 'out_for_delivery', and
// delivery_mode = 'delivery'. If two delivery partners tap "Accept" on the
// same order at nearly the same time, only the first write's WHERE clause
// still matches — the second one affects 0 rows and we show a friendly
// "already taken" message instead of a raw Supabase error.
export default function DeliveryClaimButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error: updateError } = await supabase
      .from("orders")
      .update({ delivery_partner_id: user!.id, assigned_at: new Date().toISOString() })
      .eq("id", orderId)
      .is("delivery_partner_id", null)
      .eq("status", "out_for_delivery")
      .select("id");

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    if (!data || data.length === 0) {
      setError("Someone else already accepted this order.");
      router.refresh();
      return;
    }
    router.refresh();
  }

  return (
    <div>
      {error && <p className="text-alert text-sm mb-2">{error}</p>}
      <button onClick={handleClick} disabled={loading} className="btn-primary w-full">
        {loading ? "Accepting…" : "Accept & pick up"}
      </button>
    </div>
  );
}
