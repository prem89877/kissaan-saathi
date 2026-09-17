"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const REASONS = [
  "Wrong product",
  "Wrong quantity",
  "Significant quality mismatch",
  "Damaged produce",
  "Delivery-related issue",
  "Other",
];

async function fileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function DisputeForm({ orderId, onCancel }: { orderId: string; onCancel: () => void }) {
  const router = useRouter();
  const [reason, setReason] = useState(REASONS[0]);
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    setPhotos((p) => [...p, ...files].slice(0, 10));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      setError("Please describe what went wrong.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: dispute, error: disputeError } = await supabase
      .from("disputes")
      .insert({
        order_id: orderId,
        buyer_id: user!.id,
        reason,
        description: description.trim(),
        status: "open",
      })
      .select("id")
      .single();

    if (disputeError || !dispute) {
      setError("Could not submit dispute: " + (disputeError?.message ?? "unknown error"));
      setSubmitting(false);
      return;
    }

    for (const file of photos) {
      const hash = await fileHash(file);
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${dispute.id}/${hash}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("dispute-evidence").upload(path, file, { upsert: false });
      if (!uploadError) {
        await supabase.from("dispute_evidence").insert({ dispute_id: dispute.id, storage_path: path });
      }
    }

    // Moves the order into the DISPUTED state — a valid transition only from
    // 'delivered', enforced by the enforce_order_transition trigger.
    const { error: statusError } = await supabase.from("orders").update({ status: "disputed" }).eq("id", orderId);
    if (statusError) {
      setError("Dispute recorded, but order status couldn't be updated: " + statusError.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card border-alert flex flex-col gap-3">
      <h2 className="font-medium text-alert">Report a problem</h2>

      {error && <p className="text-alert text-sm">{error}</p>}

      <label className="text-sm text-soil/70">
        Reason
        <select className="input-field mt-1" value={reason} onChange={(e) => setReason(e.target.value)}>
          {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>

      <label className="text-sm text-soil/70">
        Describe what happened
        <textarea className="input-field mt-1 min-h-[80px]" value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>

      <label className="btn-secondary text-center cursor-pointer">
        Add photos (optional evidence)
        <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handlePhotoSelect} />
      </label>
      {photos.length > 0 && <p className="text-soil/60 text-sm">{photos.length} photo(s) attached</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="btn-primary flex-1">
          {submitting ? "Submitting…" : "Submit dispute"}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
      </div>
    </form>
  );
}
