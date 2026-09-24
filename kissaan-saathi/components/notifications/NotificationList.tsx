"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { renderNotification, timeAgo, uiText } from "@/lib/notifications/text";
import { useNotifications } from "./NotificationProvider";

// Shared "Notifications" screen for all four roles.
export default function NotificationList() {
  const { items, unreadCount, loading, markRead, markAllRead } = useNotifications();
  const { lang } = useTranslation();
  const router = useRouter();
  const ui = uiText(lang);
  const [onlyUnread, setOnlyUnread] = useState(false);

  const shown = onlyUnread ? items.filter((n) => !n.is_read) : items;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl text-field">{ui.title}</h1>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-field underline text-sm min-h-[44px]">
            {ui.markAll}
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setOnlyUnread(false)}
          className={`px-3 py-2 rounded-full text-sm min-h-[40px] ${!onlyUnread ? "bg-field text-sand" : "bg-field/10 text-field"}`}
        >
          {ui.all}
        </button>
        <button
          onClick={() => setOnlyUnread(true)}
          className={`px-3 py-2 rounded-full text-sm min-h-[40px] ${onlyUnread ? "bg-field text-sand" : "bg-field/10 text-field"}`}
        >
          {ui.unread}{unreadCount > 0 ? ` (${unreadCount})` : ""}
        </button>
      </div>

      {loading && <p className="text-soil/60">{ui.loading}</p>}

      {!loading && shown.length === 0 && (
        <div className="card text-center py-8">
          <p className="font-medium text-soil">{ui.empty}</p>
          <p className="text-soil/60 text-sm mt-1">{ui.emptyHint}</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {shown.map((n) => {
          const { title, body } = renderNotification(n, lang);
          return (
            <button
              key={n.id}
              onClick={() => {
                markRead(n.id);
                if (n.link) router.push(n.link);
              }}
              className={`text-left rounded-card border p-4 ${
                n.is_read
                  ? "bg-white border-soil/10"
                  : "bg-marigold/10 border-marigold border-l-4"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className={`text-soil ${n.is_read ? "font-normal" : "font-semibold"}`}>{title}</p>
                {!n.is_read && (
                  <span className="shrink-0 text-[11px] font-semibold bg-alert text-white rounded-full px-2 py-0.5">
                    {ui.newBadge}
                  </span>
                )}
              </div>
              {body && <p className={`text-sm mt-1 line-clamp-3 ${n.is_read ? "text-soil/60" : "text-soil/80"}`}>{body}</p>}
              <p className="text-xs text-soil/50 mt-2">{timeAgo(n.created_at, lang)}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
