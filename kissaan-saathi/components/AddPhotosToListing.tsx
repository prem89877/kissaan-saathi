"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MIN_PHOTOS = 10;

async function fileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function AddPhotosToListing({
  listingId,
  existingCount,
}: {
  listingId: string;
  existingCount: number;
}) {
  const router = useRouter();
  const [totalCount, setTotalCount] = useState(existingCount);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressText, setProgressText] = useState<string | null>(null);

  async function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    setUploading(true);
    const supabase = createClient();

    const { data: existingRows } = await supabase
      .from("product_images")
      .select("file_hash")
      .eq("listing_id", listingId);
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
      const path = `${listingId}/${hash}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(path, file, { upsert: false });

      if (uploadError) {
        setError(`Photo failed to upload: ${uploadError.message}`);
        continue;
      }

      const { error: rowError } = await supabase.from("product_images").insert({
        listing_id: listingId,
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

  return (
    <div className="card flex flex-col gap-3">
      <h2 className="font-medium text-field">Add photos</h2>
      <p className="text-sm text-soil/70">
        {totalCount} / {MIN_PHOTOS} photos uploaded. Add more until you reach the {MIN_PHOTOS}-photo minimum for admin review.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <label className="btn-secondary text-center cursor-pointer">
          Take photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleSelect}
            disabled={uploading}
          />
        </label>
        <label className="btn-secondary text-center cursor-pointer">
          Choose from gallery
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleSelect}
            disabled={uploading}
          />
        </label>
      </div>

      {progressText && <p className="text-sm text-soil/70">{progressText}</p>}
      {error && <p className="text-alert text-sm">{error}</p>}
    </div>
  );
}
