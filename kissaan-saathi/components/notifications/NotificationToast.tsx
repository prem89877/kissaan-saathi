"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { renderNotification, uiText } from "@/lib/notifications/text";
import { useNotifications } from "./NotificationProvider";

// The "something just happened" banner. It slides in at the top the moment a
// new notification arrives (unless the user is already on that screen).
export default function NotificationToast() {
  const { toast, dismissToast, markRead } = useNotifications();
  const { lang } = useTranslation();
  const router = useRouter();

  useEffect(() => {
    if (!toast) return;
    if (typeof navigator !== "undefined") navigator.vibrate?.(80);
    const timer = window.setTimeout(dismissToast, 6000);
    return () => window.clearTimeout(timer);
  }, [toast, dismissToast]);

  if (!toast) return null;
  const { title, body } = renderNotification(toast, lang);

  function open() {
    if (!toast) return;
    markRead(toast.id);
    dismissToast();
    if (toast.link) router.push(toast.link);
  }

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 px-3 pointer-events-none"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 8px)" }}
    >
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto mx-auto max-w-md flex items-start gap-2 rounded-card border border-soil/10 border-l-4 border-l-marigold bg-white p-3 shadow-lg"
      >
        <button type="button" onClick={open} className="flex-1 text-left min-h-[44px]">
          <p className="font-medium text-soil text-sm">{title}</p>
          {body && <p className="text-soil/70 text-sm line-clamp-2">{body}</p>}
        </button>
        <button
          type="button"
          onClick={dismissToast}
          aria-label={uiText(lang).close}
          className="text-soil/50 text-xl leading-none min-w-[32px] min-h-[32px]"
        >
          ×
        </button>
      </div>
    </div>
  );
}
