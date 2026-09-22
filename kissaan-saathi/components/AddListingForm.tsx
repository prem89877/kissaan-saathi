"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Category = { id: string; name: string; parent_id: string | null };

const MIN_PHOTOS = 10;

async function fileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function AddListingForm({ categories }: { categories: Category[] }) {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    categoryId: categories[0]?.id ?? "",
    pricePerKg: "",
    availableQty: "",
    moq: "",
    grade: "",
    qualityDescription: "",
    harvestDate: "",
    shelfLifeDays: "",
    deliveryRadiusKm: "",
  });

  const [photos, setPhotos] = useState<{ file: File; hash: string; preview: string }[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progressText, setProgressText] = useState<string | null>(null);

  function update(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setPhotoError(null);
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow re-selecting the same filename later if needed

    const remainingSlots = 20 - photos.length;
    if (files.length > remainingSlots) {
      setPhotoError(`You can add at most 20 photos total.`);
    }

    const toProcess = files.slice(0, Math.max(remainingSlots, 0));
    const existingHashes = new Set(photos.map((p) => p.hash));
    const added: { file: File; hash: string; preview: string }[] = [];
    let duplicateCount = 0;

    for (const file of toProcess) {
      if (!file.type.startsWith("image/")) continue;
      const hash = await fileHash(file);
      if (existingHashes.has(hash)) {
        duplicateCount++;
        continue;
      }
      existingHashes.add(hash);
      added.push({ file, hash, preview: URL.createObjectURL(file) });
    }

    if (duplicateCount > 0) {
      setPhotoError(
        `${duplicateCount} photo(s) looked identical to one you already added and were skipped. Please upload ${MIN_PHOTOS} different current photos.`
      );
    }

    setPhotos((p) => [...p, ...added]);
  }

  function removePhoto(hash: string) {
    setPhotos((p) => p.filter((photo) => photo.hash !== hash));
  }

  function validate(): string | null {
    const price = parseFloat(form.pricePerKg);
    const qty = parseFloat(form.availableQty);
    const moq = parseFloat(form.moq);

    if (!form.name.trim()) return "Product name is required.";
    if (!form.categoryId) return "Please select a category.";
    if (!(price > 0)) return "Price per kg must be a positive number.";
    if (!(qty > 0)) return "Available quantity must be a positive number.";
    if (!(moq > 0)) return "Minimum order quantity must be a positive number.";
    if (moq > qty) return "MOQ cannot be more than the available quantity.";
    if (photos.length < MIN_PHOTOS)
      return `Please upload at least ${MIN_PHOTOS} different current photos (you have ${photos.length}).`;
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const validationError = validate();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setFormError("You've been signed out. Please log in again.");
      setSubmitting(false);
      return;
    }

    setProgressText("Creating listing…");
    const { data: listing, error: insertError } = await supabase
      .from("product_listings")
      .insert({
        farmer_id: user.id,
        category_id: form.categoryId,
        name: form.name.trim(),
        price_per_kg: parseFloat(form.pricePerKg),
        available_qty: parseFloat(form.availableQty),
        moq: parseFloat(form.moq),
        grade: form.grade || null,
        quality_description: form.qualityDescription || null,
        harvest_date: form.harvestDate || null,
        shelf_life_days: form.shelfLifeDays ? parseInt(form.shelfLifeDays, 10) : null,
        delivery_radius_km: form.deliveryRadiusKm ? parseFloat(form.deliveryRadiusKm) : null,
      })
      .select("id")
      .single();

    if (insertError || !listing) {
      setFormError("Could not save listing: " + (insertError?.message ?? "unknown error"));
      setSubmitting(false);
      setProgressText(null);
      return;
    }

    // Upload photos one at a time so we can show progress and so a single
    // failure doesn't silently lose track of which photos succeeded.
    let uploaded = 0;
    for (const photo of photos) {
      setProgressText(`Uploading photo ${uploaded + 1} of ${photos.length}…`);
      const ext = photo.file.name.split(".").pop() || "jpg";
      const path = `${listing.id}/${photo.hash}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(path, photo.file, { upsert: false });

      if (uploadError) {
        setFormError(
          `Listing was created but photo ${uploaded + 1} failed to upload: ${uploadError.message}. ` +
          `You can find this listing in "My listings" — re-uploading photos isn't available yet in this phase.`
        );
        setSubmitting(false);
        setProgressText(null);
        return;
      }

      const { error: imageRowError } = await supabase.from("product_images").insert({
        listing_id: listing.id,
        storage_path: path,
        file_hash: photo.hash,
      });

      if (imageRowError) {
        setFormError("Photo uploaded but couldn't be recorded: " + imageRowError.message);
        setSubmitting(false);
        setProgressText(null);
        return;
      }

      uploaded++;
    }

    setProgressText(null);
    setSubmitting(false);
    // Send them straight to set a pickup location for this new listing —
    // it's needed before any Buyer Pickup order on it can work. This is
    // just a navigation change; listing/photo creation above is untouched.
    router.push(`/farmer/listings/${listing.id}/pickup-location`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 pb-10">
      {formError && (
        <p className="text-alert bg-alert/10 rounded-card px-4 py-3">{formError}</p>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="font-medium text-field">Product</h2>
        <input required placeholder="Product name (e.g. Tomato)" className="input-field" value={form.name} onChange={update("name")} />
        <select required className="input-field" value={form.categoryId} onChange={update("categoryId")}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-medium text-field">Price &amp; quantity</h2>
        <input required type="number" min="0.01" step="0.01" placeholder="Price per kg (₹)" className="input-field" value={form.pricePerKg} onChange={update("pricePerKg")} />
        <input required type="number" min="0.01" step="0.01" placeholder="Available quantity (kg)" className="input-field" value={form.availableQty} onChange={update("availableQty")} />
        <input required type="number" min="0.01" step="0.01" placeholder="Minimum order quantity (kg)" className="input-field" value={form.moq} onChange={update("moq")} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-medium text-field">Quality</h2>
        <input placeholder="Grade (e.g. A, B)" className="input-field" value={form.grade} onChange={update("grade")} />
        <textarea placeholder="Quality description" className="input-field min-h-[80px]" value={form.qualityDescription} onChange={update("qualityDescription")} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-medium text-field">Harvest &amp; shelf life</h2>
        <label className="text-sm text-soil/70">Harvest date
          <input type="date" className="input-field mt-1" value={form.harvestDate} onChange={update("harvestDate")} />
        </label>
        <input type="number" min="0" placeholder="Expected shelf life (days)" className="input-field" value={form.shelfLifeDays} onChange={update("shelfLifeDays")} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-medium text-field">Delivery</h2>
        <input type="number" min="0" step="0.1" placeholder="Maximum delivery radius (km)" className="input-field" value={form.deliveryRadiusKm} onChange={update("deliveryRadiusKm")} />
        <p className="text-soil/60 text-sm">
          Delivery is handled by Kissaan Saathi Delivery — the cost is calculated automatically from distance and weight, you don't need to estimate it.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-medium text-field">Photos</h2>
        <p className="text-sm text-soil/70">
          Upload at least {MIN_PHOTOS} different current photos of the produce.
          These are reviewed by admin before your listing goes live — they're
          evidence for that review, not a guarantee of quality or quantity.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <label className="btn-secondary text-center cursor-pointer">
            Take photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoSelect}
            />
          </label>
          <label className="btn-secondary text-center cursor-pointer">
            Choose from gallery
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handlePhotoSelect}
            />
          </label>
        </div>

        <p className={`text-sm font-medium ${photos.length >= MIN_PHOTOS ? "text-field" : "text-alert"}`}>
          {photos.length} / {MIN_PHOTOS} photos added
        </p>
        {photoError && <p className="text-alert text-sm">{photoError}</p>}

        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <div key={p.hash} className="relative aspect-square">
                <img src={p.preview} alt="" className="w-full h-full object-cover rounded-card" />
                <button
                  type="button"
                  onClick={() => removePhoto(p.hash)}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 text-xs"
                  aria-label="Remove photo"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <button type="submit" disabled={submitting} className="btn-primary">
        {progressText || (submitting ? "Submitting…" : "Submit for review")}
      </button>
    </form>
  );
}
