"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DeliveryUpiForm({
  initialUpiId,
  initialHolderName,
}: {
  initialUpiId: string | null;
  initialHolderName: string | null;
}) {
  const router = useRouter();
  const [upiId, setUpiId] = useState(initialUpiId ?? "");
  const [holderName, setHolderName] = useState(initialHolderName ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // upsert (not update) because a delivery partner might not have a
    // delivery_profiles row yet — farmer_profiles rows always exist from
    // signup, but this table starts empty until the partner sets a UPI ID.
    const { error: upsertError } = await supabase.from("delivery_profiles").upsert(
      {
        user_id: user!.id,
        upi_id: upiId.trim() || null,
        upi_holder_name: holderName.trim() || null,
      },
      { onConflict: "user_id" }
    );

    setSaving(false);
    if (upsertError) {
      setError(upsertError.message);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card flex flex-col gap-3">
      <h2 className="font-medium text-field">UPI details for weekly settlement</h2>
      <p className="text-soil/60 text-sm">
        Used every Sunday when the admin pays your pending delivery balance directly via UPI.
      </p>
      {error && <p className="text-alert text-sm">{error}</p>}
      {saved && <p className="text-field text-sm">Saved.</p>}

      <input
        placeholder="UPI ID (e.g. yourname@bank)"
        className="input-field"
        value={upiId}
        onChange={(e) => setUpiId(e.target.value)}
      />
      <input
        placeholder="UPI holder name"
        className="input-field"
        value={holderName}
        onChange={(e) => setHolderName(e.target.value)}
      />
      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? "Saving…" : "Save UPI details"}
      </button>
    </form>
  );
}
