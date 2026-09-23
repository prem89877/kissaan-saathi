"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { distanceKm } from "@/lib/distance";
import { timeAgoLabel } from "@/lib/relativeTime";

const POLL_INTERVAL_MS = 15000;

type LiveRow = {
  latitude: number;
  longitude: number;
  is_active: boolean;
  updated_at: string;
};

// Buyer-side tracking card. Polls delivery_partner_locations for this order
// (RLS already restricts this to the buyer's own delivery_mode='delivery'
// order) and shows an approximate straight-line distance using the same
// distanceKm() helper the farmer-location feature already uses — no
// duplicate distance logic.
export default function DeliveryPartnerLiveLocation({
  orderId,
  buyerLatitude,
  buyerLongitude,
}: {
  orderId: string;
  buyerLatitude: number | null;
  buyerLongitude: number | null;
}) {
  const [row, setRow] = useState<LiveRow | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function poll() {
      const { data } = await supabase
        .from("delivery_partner_locations")
        .select("latitude, longitude, is_active, updated_at")
        .eq("order_id", orderId)
        .maybeSingle();
      if (!cancelled) {
        setRow((data as LiveRow) ?? null);
        setLoaded(true);
      }
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [orderId]);

  if (!loaded) return null;

  const distance = row?.is_active ? distanceKm(buyerLatitude, buyerLongitude, row.latitude, row.longitude) : null;

  return (
    <section className="card border-field">
      <h2 className="font-medium text-field mb-2">🚴 Your Delivery</h2>
      {row && row.is_active ? (
        <div className="flex flex-col gap-1">
          <p className="text-soil">
            {distance != null
              ? `Your delivery partner is approximately ${distance} km away`
              : "Your delivery partner is on the way"}
          </p>
          <p className="text-soil/60 text-sm">{timeAgoLabel(row.updated_at)}</p>
          <p className="text-field text-sm font-medium mt-1">Live location active</p>
        </div>
      ) : (
        <p className="text-soil/60 text-sm">Location temporarily unavailable</p>
      )}
    </section>
  );
}
