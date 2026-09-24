"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import type { Section } from "@/lib/notifications/text";

// `badge` (optional) = which kind of notifications should light up this tab:
// "dashboard" | "listings" | "chats" | "orders" | "disputes".
type NavItem = { href: string; label: string; badge?: string };

export default function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const { unreadBySection } = useNotifications();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-soil/10 flex z-10 pb-[env(safe-area-inset-bottom)]">
      {items.map((item) => {
        const active = pathname.startsWith(item.href);
        const unread = item.badge ? unreadBySection[item.badge as Section] ?? 0 : 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 text-center py-3 text-sm min-h-[56px] flex items-center justify-center
              ${active ? "text-field font-medium border-t-2 border-field" : "text-soil/60"}`}
          >
            <span className="relative">
              {item.label}
              {unread > 0 && (
                <span
                  aria-label={`${unread}`}
                  className="absolute -top-2 -right-4 min-w-[18px] h-[18px] px-1 rounded-full bg-alert text-white text-[10px] font-semibold flex items-center justify-center"
                >
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
