"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function FarmerUpiForm({
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

    const { error: updateError } = await supabase
      .from("farmer_profiles")
      .update({
        upi_id: upiId.trim() || null,
        upi_holder_name: holderName.trim() || null,
      })
      .eq("user_id", user!.id);

    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card flex flex-col gap-3">
      <h2 className="font-medium text-field">UPI details for weekly settlement</h2>
      <p className="text-soil/60 text-sm">
        Used every Saturday when the admin pays your pending balance directly via UPI.
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
