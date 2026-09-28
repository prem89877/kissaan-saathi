"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n/LanguageProvider";

// Replaces a raw OrderStatusButton for delivery_mode = 'delivery' orders:
// moving to 'out_for_delivery' should also try to auto-assign the nearest
// online delivery partner (Part D), which needs server-side logic (road
// distance lookups, cross-partner reads) — not a plain client-side
// `.update({status:...})` like the generic OrderStatusButton does.
export default function ReadyForPickupButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/delivery/auto-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? t("delivery.assignmentFailed"));
        setLoading(false);
        return;
      }
      // Whether or not a partner was auto-assigned, the order is now
      // correctly 'out_for_delivery' — router.refresh() shows whichever
      // state applies (assigned, or "waiting for a partner to accept").
      router.refresh();
    } catch {
      setError(t("delivery.assignmentFailed"));
      setLoading(false);
    }
  }

  return (
    <div>
      {error && <p className="text-alert text-sm mb-2">{error}</p>}
      <button onClick={handleClick} disabled={loading} className="btn-primary w-full">
        {loading ? t("delivery.findingPartner") : t("delivery.readyForPickup")}
      </button>
    </div>
  );
}
