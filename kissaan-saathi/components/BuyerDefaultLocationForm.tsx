"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getCurrentPosition } from "@/lib/geolocation";

type LocationState = "idle" | "requesting" | "detected" | "denied" | "unavailable";

// Lets a buyer change the shop/delivery location they set (mandatorily) at
// signup. This is the SAME lat/lng saved on buyer_profiles that every new
// order defaults to (supabase/12_buyer_default_delivery_location.sql) — so
// updating it here only changes where FUTURE orders default to; it does not
// touch orders already placed.
export default function BuyerDefaultLocationForm({
  initial,
}: {
  initial: { latitude: number | null; longitude: number | null; address: string };
}) {
  const router = useRouter();

  const [locationState, setLocationState] = useState<LocationState>(
    initial.latitude != null && initial.longitude != null ? "detected" : "idle"
  );
  const [latitude, setLatitude] = useState<number | null>(initial.latitude);
  const [longitude, setLongitude] = useState<number | null>(initial.longitude);
  const [address, setAddress] = useState(initial.address);

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
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (latitude == null || longitude == null) {
      setError("Tap \"Allow Location Access\" first so we know where to send delivery partners.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error: updateError } = await supabase
      .from("buyer_profiles")
      .update({ lat: latitude, lng: longitude, address: address.trim() || null })
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
    <form onSubmit={handleSave} className="card flex flex-col gap-3">
      <div>
        <h2 className="font-medium text-field">📍 Default delivery location</h2>
        <p className="text-soil/60 text-sm">
          Every new order is delivered here by default. Make sure you're at your
          shop or wherever deliveries should reach before allowing access.
        </p>
      </div>

      {error && <p className="text-alert text-sm">{error}</p>}
      {saved && !error && <p className="text-field text-sm">Saved. New orders will use this location.</p>}

      <button
        type="button"
        onClick={handleUseLocation}
        disabled={locationState === "requesting"}
        className="btn-secondary"
      >
        {locationState === "requesting" ? "Detecting your location…" : "Allow Location Access"}
      </button>

      {locationState === "denied" && (
        <p className="text-alert text-sm">
          Location permission is required to update your delivery location. Please enable it in
          your browser/device settings and try again.
        </p>
      )}
      {locationState === "unavailable" && (
        <p className="text-alert text-sm">Couldn't detect your location right now. Please try again.</p>
      )}

      <div className="bg-sand rounded-card px-4 py-3">
        <p className="text-xs text-soil/60 mb-1">Current location</p>
        {latitude != null && longitude != null ? (
          <p className="text-soil text-sm">
            Latitude: {latitude.toFixed(6)} &nbsp;·&nbsp; Longitude: {longitude.toFixed(6)}
          </p>
        ) : (
          <p className="text-soil/50 text-sm">Not set yet.</p>
        )}
      </div>

      <label className="flex flex-col gap-1 text-sm text-soil/70">
        Address
        <input
          className="input-field"
          placeholder="Shop / delivery address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </label>

      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? "Saving…" : "Save location"}
      </button>
    </form>
  );
}
