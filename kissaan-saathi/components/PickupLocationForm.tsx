"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { getCurrentPosition } from "@/lib/geolocation";

type LocationState = "idle" | "requesting" | "detected" | "denied" | "unavailable";

export default function PickupLocationForm({
  listingId,
  initial,
}: {
  listingId: string;
  initial: {
    latitude: number | null;
    longitude: number | null;
    address: string;
    landmark: string;
    instructions: string;
    confirmed: boolean;
  };
}) {
  const router = useRouter();
  const { t } = useTranslation();

  const [locationState, setLocationState] = useState<LocationState>(
    initial.latitude != null && initial.longitude != null ? "detected" : "idle"
  );
  const [latitude, setLatitude] = useState<number | null>(initial.latitude);
  const [longitude, setLongitude] = useState<number | null>(initial.longitude);
  const [address, setAddress] = useState(initial.address);
  const [landmark, setLandmark] = useState(initial.landmark);
  const [instructions, setInstructions] = useState(initial.instructions);
  const [confirmed, setConfirmed] = useState(initial.confirmed);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUseLocation() {
    setError(null);
    setSaved(false);
    setLocationState("requesting");

    const result = await getCurrentPosition();

    if (!result.ok) {
      setLocationState(result.reason);
      return;
    }

    setLatitude(result.latitude);
    setLongitude(result.longitude);
    setLocationState("detected");

    // Save coordinates as soon as they're detected (step 4 of the flow) —
    // this does NOT confirm the location; confirmed is left false (the
    // reset trigger enforces this on any coordinate change regardless).
    const supabase = createClient();
    const { error: upsertError } = await supabase.from("listing_pickup_locations").upsert(
      {
        listing_id: listingId,
        pickup_latitude: result.latitude,
        pickup_longitude: result.longitude,
      },
      { onConflict: "listing_id" }
    );

    if (upsertError) {
      setError(upsertError.message);
      return;
    }
    setConfirmed(false);
    router.refresh();
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (!address.trim()) {
      setError(t("pickup.addressRequired"));
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error: upsertError } = await supabase.from("listing_pickup_locations").upsert(
      {
        listing_id: listingId,
        pickup_latitude: latitude,
        pickup_longitude: longitude,
        pickup_address: address.trim(),
        pickup_landmark: landmark.trim() || null,
        pickup_instructions: instructions.trim() || null,
        pickup_location_confirmed: true,
      },
      { onConflict: "listing_id" }
    );

    setSaving(false);
    if (upsertError) {
      setError(upsertError.message);
      return;
    }

    setConfirmed(true);
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleConfirm} className="card flex flex-col gap-4">
      <div>
        <h2 className="font-medium text-field">{t("pickup.title")}</h2>
        <p className="text-soil/60 text-sm">{t("pickup.subtitle")}</p>
      </div>

      {confirmed ? (
        <p className="text-field text-sm font-medium">✓ {t("pickup.confirmed")}</p>
      ) : (
        <p className="text-marigold-dark text-sm">{t("pickup.notConfirmed")}</p>
      )}

      {error && <p className="text-alert text-sm">{error}</p>}
      {saved && !error && <p className="text-field text-sm">{t("pickup.saved")}</p>}

      <button
        type="button"
        onClick={handleUseLocation}
        disabled={locationState === "requesting"}
        className="btn-secondary"
      >
        {locationState === "requesting" ? t("pickup.detecting") : t("pickup.useMyLocation")}
      </button>

      {locationState === "denied" && (
        <p className="text-alert text-sm">
          {t("pickup.permissionDenied")} — {t("pickup.permissionDeniedHelp")}
        </p>
      )}
      {locationState === "unavailable" && (
        <p className="text-alert text-sm">
          {t("pickup.unavailable")} — {t("pickup.unavailableHelp")}
        </p>
      )}

      <div className="bg-sand rounded-card px-4 py-3">
        <p className="text-xs text-soil/60 mb-1">{t("pickup.detectedLabel")}</p>
        {latitude != null && longitude != null ? (
          <p className="text-soil text-sm">
            {t("pickup.latitude")}: {latitude.toFixed(6)} &nbsp;·&nbsp; {t("pickup.longitude")}: {longitude.toFixed(6)}
          </p>
        ) : (
          <p className="text-soil/50 text-sm">{t("pickup.noCoordinates")}</p>
        )}
      </div>

      <label className="flex flex-col gap-1 text-sm text-soil/70">
        {t("pickup.address")}
        <input
          required
          className="input-field"
          placeholder={t("pickup.addressPlaceholder")}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-soil/70">
        {t("pickup.landmark")}
        <input
          className="input-field"
          placeholder={t("pickup.landmarkPlaceholder")}
          value={landmark}
          onChange={(e) => setLandmark(e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-soil/70">
        {t("pickup.instructions")}
        <textarea
          className="input-field min-h-[80px]"
          placeholder={t("pickup.instructionsPlaceholder")}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
      </label>

      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? t("pickup.saving") : t("pickup.confirm")}
      </button>
    </form>
  );
}
