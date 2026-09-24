"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { uiText } from "@/lib/notifications/text";
import { useNotifications } from "./NotificationProvider";

export default function NotificationBell({ role }: { role: "farmer" | "buyer" | "admin" | "delivery" }) {
  const { unreadCount } = useNotifications();
  const { lang } = useTranslation();
  const ui = uiText(lang);

  return (
    <Link
      href={`/${role}/notifications`}
      aria-label={unreadCount > 0 ? `${ui.title}, ${ui.unreadN(unreadCount)}` : ui.title}
      className="relative flex items-center justify-center min-w-[44px] min-h-[44px] text-sand"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {unreadCount > 0 && (
        <span className="absolute top-1 right-0.5 min-w-[20px] h-5 px-1 rounded-full bg-alert text-white text-[11px] font-semibold flex items-center justify-center">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
