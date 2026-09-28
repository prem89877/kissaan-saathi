"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getCurrentPosition } from "@/lib/geolocation";
import { useTranslation } from "@/lib/i18n/LanguageProvider";

// Refresh the partner's location every 2 minutes while online — frequent
// enough that auto-assignment (which only considers rows updated in the
// last 15 minutes, see app/api/delivery/auto-assign) sees a fresh fix,
// without pushing writes as often as the per-order live-tracking share
// (DeliveryLocationShareButton, 15s) since no buyer is watching this one.
const REFRESH_INTERVAL_MS = 2 * 60 * 1000;

export default function DeliveryOnlineToggle({
  userId,
  initialOnline,
}: {
  userId: string;
  initialOnline: boolean;
}) {
  const { t } = useTranslation();
  const [online, setOnline] = useState(initialOnline);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function pushStatus(isOnline: boolean) {
    const supabase = createClient();
    const result = await getCurrentPosition();
    if (!result.ok) {
      setError(
        result.reason === "denied"
          ? t("delivery.locationDenied")
          : t("delivery.locationUnavailable")
      );
      if (isOnline) return false;
    }
    await supabase.from("delivery_partner_status").upsert(
      {
        partner_id: userId,
        is_online: isOnline,
        latitude: result.ok ? result.latitude : null,
        longitude: result.ok ? result.longitude : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "partner_id" }
    );
    return true;
  }

  async function handleToggle() {
    setBusy(true);
    setError(null);
    const next = !online;
    const ok = await pushStatus(next);
    setBusy(false);
    if (next && !ok) return; // couldn't get a location fix — stay offline
    setOnline(next);
  }

  useEffect(() => {
    if (online) {
      intervalRef.current = setInterval(() => pushStatus(true), REFRESH_INTERVAL_MS);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  return (
    <div className="card border-field flex items-center justify-between">
      <div>
        <p className="font-medium text-soil text-sm">{t("delivery.onlineStatus")}</p>
        <p className="text-soil/60 text-xs mt-0.5">
          {online ? t("delivery.onlineHelp") : t("delivery.offlineHelp")}
        </p>
        {error && <p className="text-alert text-xs mt-1">{error}</p>}
      </div>
      <button
        onClick={handleToggle}
        disabled={busy}
        className={online ? "btn-primary" : "btn-secondary"}
      >
        {busy ? t("otp.confirming") : online ? t("delivery.goOffline") : t("delivery.goOnline")}
      </button>
    </div>
  );
}
