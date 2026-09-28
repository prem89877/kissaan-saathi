"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const REASON_KEYS: TranslationKey[] = [
  "dispute.reasonWrongProduct",
  "dispute.reasonWrongQuantity",
  "dispute.reasonQualityMismatch",
  "dispute.reasonDamaged",
  "dispute.reasonDeliveryIssue",
  "dispute.reasonOther",
];

// Canonical English value stored in the DB, matching the original
// hardcoded REASONS list this replaces — unaffected by UI language.
const CANONICAL_REASON: Record<TranslationKey, string> = {
  "dispute.reasonWrongProduct": "Wrong product",
  "dispute.reasonWrongQuantity": "Wrong quantity",
  "dispute.reasonQualityMismatch": "Significant quality mismatch",
  "dispute.reasonDamaged": "Damaged produce",
  "dispute.reasonDeliveryIssue": "Delivery-related issue",
  "dispute.reasonOther": "Other",
} as Record<TranslationKey, string>;

async function fileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function DisputeForm({ orderId, onCancel }: { orderId: string; onCancel: () => void }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [reasonKey, setReasonKey] = useState<TranslationKey>(REASON_KEYS[0]);
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
      setError(t("dispute.describeRequired"));
      return;
    }
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Stored value stays the canonical English label regardless of UI
    // language — this matches what admin tooling and any existing DB
    // constraint on this column already expect. Only the label shown to the
    // buyer is translated.
    const { data: dispute, error: disputeError } = await supabase
      .from("disputes")
      .insert({
        order_id: orderId,
        buyer_id: user!.id,
        reason: CANONICAL_REASON[reasonKey],
        description: description.trim(),
        status: "open",
      })
      .select("id")
      .single();

    if (disputeError || !dispute) {
      // The 6-hour window trigger (16_dispute_six_hour_window.sql) rejects
      // late inserts with a plain-language Postgres exception — surface that
      // message as-is since it's already meant for the buyer to read.
      setError(disputeError?.message || t("dispute.submitFailed"));
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
      setError(t("dispute.statusUpdateFailed") + ": " + statusError.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card border-alert flex flex-col gap-3">
      <h2 className="font-medium text-alert">{t("dispute.reportProblem")}</h2>

      {error && <p className="text-alert text-sm">{error}</p>}

      <label className="text-sm text-soil/70">
        {t("dispute.reasonLabel")}
        <select
          className="input-field mt-1"
          value={reasonKey}
          onChange={(e) => setReasonKey(e.target.value as TranslationKey)}
        >
          {REASON_KEYS.map((key) => (
            <option key={key} value={key}>{t(key)}</option>
          ))}
        </select>
      </label>

      <label className="text-sm text-soil/70">
        {t("dispute.describeLabel")}
        <textarea className="input-field mt-1 min-h-[80px]" value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="btn-secondary text-center cursor-pointer">
          {t("dispute.takePhoto")}
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoSelect} />
        </label>
        <label className="btn-secondary text-center cursor-pointer">
          {t("dispute.chooseFromGallery")}
          <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoSelect} />
        </label>
      </div>
      {photos.length > 0 && <p className="text-soil/60 text-sm">{photos.length} {t("dispute.photosAttached")}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="btn-primary flex-1">
          {submitting ? t("dispute.submitting") : t("dispute.submit")}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">{t("common.cancel")}</button>
      </div>
    </form>
  );
}
