"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MIN_PHOTOS = 10;

async function fileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function PackingEvidenceUploader({
  orderId,
  existingCount,
}: {
  orderId: string;
  existingCount: number;
}) {
  const router = useRouter();
  const [totalCount, setTotalCount] = useState(existingCount);
  const [uploading, setUploading] = useState(false);
  const [markingPacked, setMarkingPacked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressText, setProgressText] = useState<string | null>(null);

  useEffect(() => setTotalCount(existingCount), [existingCount]);

  async function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    setUploading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: existingRows } = await supabase
      .from("packing_evidence")
      .select("file_hash")
      .eq("order_id", orderId);
    const existingHashes = new Set((existingRows ?? []).map((r) => r.file_hash));

    let uploaded = 0;
    let skipped = 0;

    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      const hash = await fileHash(file);
      if (existingHashes.has(hash)) {
        skipped++;
        continue;
      }
      existingHashes.add(hash);

      setProgressText(`Uploading photo ${uploaded + 1} of ${files.length}…`);
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${orderId}/${hash}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("packing-evidence")
        .upload(path, file, { upsert: false });

      if (uploadError) {
        setError(`Photo failed to upload: ${uploadError.message}`);
        continue;
      }

      const { error: rowError } = await supabase.from("packing_evidence").insert({
        order_id: orderId,
        seller_id: user!.id,
        storage_path: path,
        file_hash: hash,
      });

      if (rowError) {
        setError(`Photo uploaded but couldn't be recorded: ${rowError.message}`);
        continue;
      }

      uploaded++;
    }

    if (skipped > 0) {
      setError(`${skipped} photo(s) looked identical to one already uploaded and were skipped.`);
    }

    setTotalCount((c) => c + uploaded);
    setProgressText(null);
    setUploading(false);
    router.refresh();
  }

  async function markPacked() {
    setMarkingPacked(true);
    setError(null);
    const supabase = createClient();
    // The enforce_min_packing_photos trigger (Phase 1) blocks this update
    // outright if there are still fewer than 10 photos recorded.
    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: "packed" })
      .eq("id", orderId);

    setMarkingPacked(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-soil/70">
        Upload at least {MIN_PHOTOS} current photos showing the packed produce —
        different angles, the packaging, and a weighing scale if you have one.
      </p>

      <label className="btn-secondary text-center cursor-pointer">
        Take photo or choose from gallery
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={handleSelect}
          disabled={uploading}
        />
      </label>

      <p className={`text-sm font-medium ${totalCount >= MIN_PHOTOS ? "text-field" : "text-alert"}`}>
        {progressText || `${totalCount} / ${MIN_PHOTOS} photos uploaded`}
      </p>

      {error && <p className="text-alert text-sm">{error}</p>}

      <button onClick={markPacked} disabled={totalCount < MIN_PHOTOS || markingPacked} className="btn-primary">
        {markingPacked ? "Saving…" : "Mark as packed"}
      </button>
    </div>
  );
}
