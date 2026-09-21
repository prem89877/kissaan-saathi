"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

export default function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-soil/10 flex z-10 pb-[env(safe-area-inset-bottom)]">
      {items.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 text-center py-3 text-sm min-h-[56px] flex items-center justify-center
              ${active ? "text-field font-medium border-t-2 border-field" : "text-soil/60"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
