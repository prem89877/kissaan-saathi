"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/LanguageProvider";

export default function EmailNotificationToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);

  async function handleToggle() {
    setBusy(true);
    const next = !enabled;
    const supabase = createClient();
    const { error } = await supabase.rpc("set_email_notifications_enabled", { p_enabled: next });
    setBusy(false);
    if (!error) {
      setEnabled(next);
      router.refresh();
    }
  }

  return (
    <label className="flex items-center justify-between gap-3 py-1">
      <span className="text-soil/80 text-sm">{t("emailToggle.label")}</span>
      <button
        onClick={handleToggle}
        disabled={busy}
        className={`w-11 h-6 rounded-full transition-colors relative ${enabled ? "bg-field" : "bg-soil/20"}`}
        aria-pressed={enabled}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}
