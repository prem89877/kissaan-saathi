"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function FulfillPayoutRequestForm({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [utr, setUtr] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!utr.trim()) {
      setError("UTR / transaction ID is required.");
      return;
    }
    setSubmitting(true);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("fulfill_farmer_payout_request", {
      p_request_id: requestId,
      p_utr_reference: utr.trim(),
      p_payment_date: paymentDate,
    });
    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.push("/admin/payout-requests");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card border-field flex flex-col gap-3">
      <h2 className="font-medium text-field">Record UPI payment</h2>
      {error && <p className="text-alert text-sm">{error}</p>}

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
