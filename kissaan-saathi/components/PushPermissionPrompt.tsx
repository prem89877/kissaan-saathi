"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/LanguageProvider";

const DISMISSED_KEY = "ks_push_prompt_dismissed";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// A quiet, dismissible banner — never a browser permission popup out of
// nowhere. If the person denies or dismisses, we never ask again on this
// device (Part E: "handle denied notification permissions gracefully").
export default function PushPermissionPrompt({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) return; // push isn't configured on this deployment yet
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;
    if (Notification.permission !== "default") return; // already granted or denied elsewhere
    setVisible(true);
  }, []);

  async function handleEnable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        localStorage.setItem(DISMISSED_KEY, "1");
        setVisible(false);
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = subscription.toJSON();
      const supabase = createClient();
      await supabase.from("push_subscriptions").upsert(
        {
          user_id: userId,
          endpoint: json.endpoint!,
          p256dh: json.keys!.p256dh,
          auth: json.keys!.auth,
        },
        { onConflict: "endpoint" }
      );
    } catch {
      // Permission dance failed or was cancelled — fine, just don't nag.
    } finally {
      setBusy(false);
      setVisible(false);
    }
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="card border-marigold flex items-center justify-between gap-3">
      <p className="text-sm text-soil">{t("push.promptText")}</p>
      <div className="flex gap-2 shrink-0">
        <button onClick={handleDismiss} className="btn-secondary text-sm">{t("push.notNow")}</button>
        <button onClick={handleEnable} disabled={busy} className="btn-primary text-sm">
          {busy ? t("otp.confirming") : t("push.enable")}
        </button>
      </div>
    </div>
  );
}
