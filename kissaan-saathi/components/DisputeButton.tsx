"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import DisputeForm from "./DisputeForm";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

function formatRemaining(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function DisputeButton({
  orderId,
  deliveredAt,
}: {
  orderId: string;
  // ISO timestamp string from order_status_history ('delivered' row), or
  // null if that row wasn't found (e.g. older orders from before this was
  // tracked). The real enforcement is the DB trigger in
  // 16_dispute_six_hour_window.sql — this is only for a clear message
  // instead of a confusing failed submit.
  deliveredAt: string | null;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!deliveredAt || now === null) {
    // Don't render a client-computed verdict before we know "now" (avoids a
    // hydration mismatch) or before we have a delivered timestamp at all —
    // fall back to allowing the attempt; the server trigger is authoritative.
    if (open) return <DisputeForm orderId={orderId} onCancel={() => setOpen(false)} />;
    return (
      <button onClick={() => setOpen(true)} className="btn-secondary border-alert text-alert w-full">
        {t("dispute.reportProblem")}
      </button>
    );
  }

  const deadline = new Date(deliveredAt).getTime() + SIX_HOURS_MS;
  const remaining = deadline - now;

  if (remaining <= 0) {
    return (
      <div className="card border-soil/20">
        <p className="font-medium text-soil">{t("dispute.windowClosedTitle")}</p>
        <p className="text-soil/70 text-sm mt-1">{t("dispute.windowClosedBody")}</p>
      </div>
    );
  }

  if (open) return <DisputeForm orderId={orderId} onCancel={() => setOpen(false)} />;

  return (
    <div className="flex flex-col gap-1">
      <button onClick={() => setOpen(true)} className="btn-secondary border-alert text-alert w-full">
        {t("dispute.reportProblem")}
      </button>
      <p className="text-soil/60 text-xs text-center">
        {t("dispute.windowRemaining")}: {formatRemaining(remaining)}
      </p>
    </div>
  );
}
