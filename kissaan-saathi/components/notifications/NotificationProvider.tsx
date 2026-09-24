"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  getNotifications,
  markAllAsRead as apiMarkAllAsRead,
  markAsRead as apiMarkAsRead,
  markManyAsRead as apiMarkManyAsRead,
  type NotificationItem,
} from "@/lib/notifications/api";
import { sectionOf, type Section } from "@/lib/notifications/text";
import NotificationToast from "./NotificationToast";

type NotificationContextValue = {
  items: NotificationItem[];
  unreadCount: number;
  unreadBySection: Partial<Record<Section, number>>;
  loading: boolean;
  toast: NotificationItem | null;
  dismissToast: () => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
};

const EMPTY: NotificationContextValue = {
  items: [],
  unreadCount: 0,
  unreadBySection: {},
  loading: false,
  toast: null,
  dismissToast: () => {},
  markRead: async () => {},
  markAllRead: async () => {},
  refresh: async () => {},
};

const NotificationContext = createContext<NotificationContextValue>(EMPTY);

// Safe to call anywhere: outside a provider it just returns "nothing new".
export function useNotifications() {
  return useContext(NotificationContext);
}

// Is this notification about the LIVE screen the user is looking at right now
// (a chat, where new messages already appear on screen as they arrive)? Only
// then is it safe to mark it read automatically and skip the pop-up.
//
// This must NOT match order/payment/listing/dispute/settlement notifications:
// those link to server-rendered pages (e.g. /buyer/orders/[id]) that do not
// live-refresh, so a buyer sitting on that exact page when the farmer accepts
// the order would otherwise get the notification silently marked read with
// no toast and no badge — the one real sign anything happened. Matching by
// `n.link === path` had the same problem for every notification type whose
// link happens to equal the page currently open (dashboard, listings, etc.),
// so that generic check is intentionally gone too.
function isAboutPath(n: NotificationItem, path: string) {
  if (n.related_conversation_id && (path.endsWith(`/chat/${n.related_conversation_id}`) || path.endsWith(`/order-summary/${n.related_conversation_id}`))) return true;
  return false;
}

function sortNewestFirst(list: NotificationItem[]) {
  return [...list].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
}

export default function NotificationProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<NotificationItem | null>(null);

  // Refs let realtime callbacks read the latest values without re-subscribing.
  const itemsRef = useRef<NotificationItem[]>([]);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  const commit = useCallback((next: NotificationItem[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  const refresh = useCallback(async () => {
    try {
      commit(await getNotifications());
    } catch {
      // Keep whatever we already show; the next refresh will try again.
    } finally {
      setLoading(false);
    }
  }, [commit]);

  const upsert = useCallback(
    (n: NotificationItem) => {
      const existing = itemsRef.current.find((i) => i.id === n.id);
      // "Fresh" = a brand-new unread notification, or another chat message
      // added to an already-unread (collapsed) one.
      const fresh = !n.is_read && (!existing || n.event_count > existing.event_count);
      commit(sortNewestFirst([n, ...itemsRef.current.filter((i) => i.id !== n.id)]));
      if (fresh && !isAboutPath(n, pathRef.current)) setToast(n);
    },
    [commit]
  );

  // Initial load + live updates + safety-net refresh.
  useEffect(() => {
    refresh();

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` },
        (payload) => upsert(payload.new as NotificationItem)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` },
        (payload) => upsert(payload.new as NotificationItem)
      )
      .subscribe();

    // If the phone slept or realtime dropped, catch up when the app comes back
    // and once a minute while it is open.
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(onVisible, 60000);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [userId, supabase, refresh, upsert]);

  const markRead = useCallback(
    async (id: string) => {
      const target = itemsRef.current.find((i) => i.id === id);
      if (!target || target.is_read) return;
      commit(itemsRef.current.map((i) => (i.id === id ? { ...i, is_read: true } : i)));
      try {
        await apiMarkAsRead(id);
      } catch {
        refresh();
      }
    },
    [commit, refresh]
  );

  const markAllRead = useCallback(async () => {
    if (!itemsRef.current.some((i) => !i.is_read)) return;
    commit(itemsRef.current.map((i) => (i.is_read ? i : { ...i, is_read: true })));
    setToast(null);
    try {
      await apiMarkAllAsRead();
    } catch {
      refresh();
    }
  }, [commit, refresh]);

  // Opening the chat / order / listing / dispute a notification is about
  // clears it automatically — no manual "mark as read" needed.
  useEffect(() => {
    const ids = items.filter((n) => !n.is_read && isAboutPath(n, pathname)).map((n) => n.id);
    if (ids.length === 0) return;
    commit(itemsRef.current.map((i) => (ids.includes(i.id) ? { ...i, is_read: true } : i)));
    apiMarkManyAsRead(ids).catch(() => refresh());
  }, [items, pathname, commit, refresh]);

  const unreadCount = useMemo(() => items.filter((i) => !i.is_read).length, [items]);
  const unreadBySection = useMemo(() => {
    const counts: Partial<Record<Section, number>> = {};
    for (const n of items) {
      if (n.is_read) continue;
      const s = sectionOf(n.type);
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return counts;
  }, [items]);

  // Installed-PWA home-screen icon badge (where the browser supports it).
  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (unreadCount > 0) nav.setAppBadge?.(unreadCount)?.catch(() => {});
    else nav.clearAppBadge?.()?.catch(() => {});
  }, [unreadCount]);
  useEffect(() => {
    return () => {
      const nav = navigator as Navigator & { clearAppBadge?: () => Promise<void> };
      nav.clearAppBadge?.()?.catch(() => {});
    };
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const value: NotificationContextValue = {
    items,
    unreadCount,
    unreadBySection,
    loading,
    toast,
    dismissToast,
    markRead,
    markAllRead,
    refresh,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationToast />
    </NotificationContext.Provider>
  );
}
