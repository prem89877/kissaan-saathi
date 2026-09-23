"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getCurrentPosition } from "@/lib/geolocation";

type LocationState = "idle" | "requesting" | "detected" | "denied" | "unavailable";

// Buyer-side counterpart to PickupLocationForm.tsx — same UX pattern, but
// writes to order_delivery_locations (one row per order) instead of
// listing_pickup_locations (one row per listing). RLS (see
// 10_buyer_delivery_and_live_tracking.sql) only lets the buyer who owns
// this order write here, and only while the order isn't yet
// delivered/completed/cancelled.
export default function BuyerDeliveryLocationForm({
  orderId,
  initial,
}: {
  orderId: string;
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
      // Clear, specific message per feature spec — and a usable fallback:
      // the address/landmark fields below still work without GPS.
      setLocationState(result.reason);
      return;
    }

    setLatitude(result.latitude);
    setLongitude(result.longitude);
    setLocationState("detected");

    const supabase = createClient();
    const { error: upsertError } = await supabase.from("order_delivery_locations").upsert(
      {
        order_id: orderId,
        delivery_latitude: result.latitude,
        delivery_longitude: result.longitude,
      },
      { onConflict: "order_id" }
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
      setError("Please enter a delivery address before confirming.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error: upsertError } = await supabase.from("order_delivery_locations").upsert(
      {
        order_id: orderId,
        delivery_latitude: latitude,
        delivery_longitude: longitude,
        delivery_address: address.trim(),
        delivery_landmark: landmark.trim() || null,
        delivery_instructions: instructions.trim() || null,
        delivery_location_confirmed: true,
        delivery_location_confirmed_at: new Date().toISOString(),
      },
      { onConflict: "order_id" }
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
        <h2 className="font-medium text-field">📍 Confirm Delivery Location</h2>
        <p className="text-soil/60 text-sm">
          The farmer has accepted your order — set where Kissaan Saathi Delivery should drop it off.
        </p>
      </div>

      {confirmed ? (
        <p className="text-field text-sm font-medium">✓ Location Confirmed</p>
      ) : (
        <p className="text-marigold-dark text-sm">Not confirmed yet.</p>
      )}

      {error && <p className="text-alert text-sm">{error}</p>}
      {saved && !error && <p className="text-field text-sm">Saved.</p>}

      <button
        type="button"
        onClick={handleUseLocation}
        disabled={locationState === "requesting"}
        className="btn-secondary"
      >
        {locationState === "requesting" ? "Detecting your location…" : "Allow Location"}
      </button>

      {locationState === "denied" && (
        <p className="text-alert text-sm">
          Location permission is required to share your delivery location. Please enable location
          permission in your browser/device settings — or just enter your address manually below.
        </p>
      )}
      {locationState === "unavailable" && (
        <p className="text-alert text-sm">
          Couldn't detect your location right now. You can still enter the address manually below.
        </p>
      )}

      <div className="bg-sand rounded-card px-4 py-3">
        <p className="text-xs text-soil/60 mb-1">Detected location</p>
        {latitude != null && longitude != null ? (
          <p className="text-soil text-sm">
            Latitude: {latitude.toFixed(6)} &nbsp;·&nbsp; Longitude: {longitude.toFixed(6)}
          </p>
        ) : (
          <p className="text-soil/50 text-sm">No GPS coordinates set yet.</p>
        )}
      </div>

      <label className="flex flex-col gap-1 text-sm text-soil/70">
        Delivery Address
        <input
          required
          className="input-field"
          placeholder="House/shop no., street, village or town"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-soil/70">
        Landmark (optional)
        <input
          className="input-field"
          placeholder="e.g. Near Shiv Mandir"
          value={landmark}
          onChange={(e) => setLandmark(e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-soil/70">
        Delivery Instructions (optional)
        <textarea
          className="input-field min-h-[80px]"
          placeholder="e.g. Call before arriving, gate on the left"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
      </label>

      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? "Saving…" : "Confirm Delivery Location"}
      </button>
    </form>
  );
}
