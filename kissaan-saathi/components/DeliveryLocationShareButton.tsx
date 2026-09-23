"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getCurrentPosition } from "@/lib/geolocation";

const UPDATE_INTERVAL_MS = 15000; // ~15s — frequent enough to feel "live"
// without hammering the database with writes (Feature 2 constraint).

// Lets the assigned delivery partner start/stop sharing their live location
// for one order. Only renders meaningfully while the order is
// 'out_for_delivery' and assigned to this partner — the parent page decides
// when to show it. Writes to delivery_partner_locations, one row per order
// (upsert), so this never grows into a location history table.
export default function DeliveryLocationShareButton({
  orderId,
  initialActive,
}: {
  orderId: string;
  initialActive: boolean;
}) {
  const [sharing, setSharing] = useState(initialActive);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function pushLocation() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const result = await getCurrentPosition();
    if (!result.ok) {
      // Don't stop sharing on a single missed fix — GPS/network hiccups are
      // normal. Just surface the message; the last known point stays
      // visible to the buyer until the next successful fix or Stop.
      setError(
        result.reason === "denied"
          ? "Location permission is required to share your live delivery status. Please enable location permission in your browser/device settings."
          : "Unable to update location. Your last known location is being shown."
      );
      return;
    }

    setError(null);
    await supabase.from("delivery_partner_locations").upsert(
      {
        order_id: orderId,
        delivery_partner_id: user.id,
        latitude: result.latitude,
        longitude: result.longitude,
        accuracy: null,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "order_id" }
    );
  }

  async function handleStart() {
    setBusy(true);
    setError(null);
    await pushLocation();
    setBusy(false);
    setSharing(true);
  }

  async function handleStop() {
    setBusy(true);
    const supabase = createClient();
    await supabase.from("delivery_partner_locations").update({ is_active: false }).eq("order_id", orderId);
    setBusy(false);
    setSharing(false);
  }

  useEffect(() => {
    if (sharing) {
      intervalRef.current = setInterval(pushLocation, UPDATE_INTERVAL_MS);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharing, orderId]);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-soil">📍 Location sharing</p>
      {error && <p className="text-alert text-xs">{error}</p>}
      {sharing ? (
        <>
          <p className="text-field text-sm">Location sharing is active</p>
          <button onClick={handleStop} disabled={busy} className="btn-secondary w-full">
            {busy ? "Stopping…" : "Stop Sharing"}
          </button>
        </>
      ) : (
        <button onClick={handleStart} disabled={busy} className="btn-primary w-full">
          {busy ? "Starting…" : "Start Delivery / Share Live Location"}
        </button>
      )}
      <p className="text-soil/50 text-xs">
        Keep this page open while delivering — if the browser is closed or backgrounded for a
        while, live tracking may pause until you reopen it.
      </p>
    </div>
  );
}
