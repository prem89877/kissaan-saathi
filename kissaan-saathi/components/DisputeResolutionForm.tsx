"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const RESOLUTIONS = [
  { value: "no_refund", label: "No refund" },
  { value: "partial_refund", label: "Partial refund" },
  { value: "full_refund", label: "Full refund" },
  { value: "replacement", label: "Replacement" },
  { value: "seller_payout_adjustment", label: "Seller payout adjustment" },
  { value: "other", label: "Other" },
];

// Only these are valid next steps from an order in the DISPUTED state —
// mirrors is_valid_order_transition() in 01_schema.sql. "no_change" means
// leave the order status as 'disputed' for now.
const ORDER_STATUS_OPTIONS = [
  { value: "no_change", label: "Leave order status as Disputed" },
  { value: "completed", label: "Mark order Completed" },
  { value: "refund_requested", label: "Move to Refund requested" },
  { value: "replacement_requested", label: "Move to Replacement requested" },
];

export default function DisputeResolutionForm({
  disputeId,
  orderId,
  orderStatus,
}: {
  disputeId: string;
  orderId: string;
  orderStatus: string;
}) {
  const router = useRouter();
  const [resolution, setResolution] = useState(RESOLUTIONS[0].value);
  const [notes, setNotes] = useState("");
  const [newOrderStatus, setNewOrderStatus] = useState("no_change");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error: disputeError } = await supabase
      .from("disputes")
      .update({
        status: "resolved",
        resolution,
        resolution_notes: notes || null,
        resolved_by: user!.id,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", disputeId);

    if (disputeError) {
      setError(disputeError.message);
      setSubmitting(false);
      return;
    }

    if (newOrderStatus !== "no_change" && orderStatus === "disputed") {
      const { error: orderError } = await supabase
        .from("orders")
        .update({ status: newOrderStatus })
        .eq("id", orderId);
      if (orderError) {
        setError("Dispute resolved, but order status update failed: " + orderError.message);
        setSubmitting(false);
        return;
      }
    }

    await supabase.from("admin_actions").insert({
      admin_id: user!.id,
      action: "dispute_resolved",
      target_table: "disputes",
      target_id: disputeId,
      metadata: { resolution, notes, new_order_status: newOrderStatus },
    });

    setSubmitting(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card border-field flex flex-col gap-3">
      <h2 className="font-medium text-field">Resolve dispute</h2>
      {error && <p className="text-alert text-sm">{error}</p>}

      <label className="text-sm text-soil/70">
        Resolution
        <select className="input-field mt-1" value={resolution} onChange={(e) => setResolution(e.target.value)}>
          {RESOLUTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </label>

      <label className="text-sm text-soil/70">
        Notes (visible to both parties)
        <textarea className="input-field mt-1 min-h-[80px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      {orderStatus === "disputed" && (
        <label className="text-sm text-soil/70">
          Order status
          <select className="input-field mt-1" value={newOrderStatus} onChange={(e) => setNewOrderStatus(e.target.value)}>
            {ORDER_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      )}

      <button type="submit" disabled={submitting} className="btn-primary">
        {submitting ? "Saving…" : "Save resolution"}
      </button>
    </form>
  );
}
