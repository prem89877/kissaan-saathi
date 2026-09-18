"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SettlementForm({
  farmerId,
  suggestedAmount,
}: {
  farmerId: string;
  suggestedAmount: number;
}) {
  const router = useRouter();
  const [amountPaid, setAmountPaid] = useState(String(suggestedAmount));
  const [utr, setUtr] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amount = parseFloat(amountPaid);
    if (!(amount > 0)) {
      setError("Amount paid must be a positive number.");
      return;
    }
    if (!utr.trim()) {
      setError("UTR / transaction ID is required.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();

    // The function recomputes the actual owed amount server-side from
    // unsettled delivered/completed orders — this form only supplies what
    // the admin actually paid, not what determines the settlement total.
    const { data: settlementId, error: rpcError } = await supabase.rpc("create_farmer_settlement", {
      p_farmer_id: farmerId,
      p_amount_paid: amount,
      p_utr_reference: utr.trim(),
      p_payment_date: paymentDate,
    });

    setSubmitting(false);
    if (rpcError || !settlementId) {
      setError(rpcError?.message ?? "Could not record the settlement.");
      return;
    }

    router.push("/admin/settlements");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card border-field flex flex-col gap-3">
      <h2 className="font-medium text-field">Record UPI payment</h2>
      {error && <p className="text-alert text-sm">{error}</p>}

      <label className="text-sm text-soil/70">
        Amount paid (₹)
        <input
          type="number"
          min="0.01"
          step="0.01"
          className="input-field mt-1"
          value={amountPaid}
          onChange={(e) => setAmountPaid(e.target.value)}
        />
      </label>

      <label className="text-sm text-soil/70">
        UTR / Transaction ID
        <input className="input-field mt-1" value={utr} onChange={(e) => setUtr(e.target.value)} />
      </label>

      <label className="text-sm text-soil/70">
        Payment date
        <input
          type="date"
          className="input-field mt-1"
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
        />
      </label>

      <button type="submit" disabled={submitting} className="btn-primary">
        {submitting ? "Saving…" : "Mark as Paid"}
      </button>
    </form>
  );
}
