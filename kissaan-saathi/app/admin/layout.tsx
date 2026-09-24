import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import BottomNav from "@/components/BottomNav";
import LanguageToggle from "@/components/LanguageToggle";
import NotificationProvider from "@/components/notifications/NotificationProvider";
import NotificationBell from "@/components/notifications/NotificationBell";
import { getServerTranslator } from "@/lib/i18n/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { t } = getServerTranslator();

  const NAV_ITEMS = [
    { href: "/admin/dashboard", badge: "dashboard", label: t("nav.dashboard") },
    { href: "/admin/listings", badge: "listings", label: t("nav.listings") },
    { href: "/admin/orders", badge: "orders", label: t("nav.orders") },
    { href: "/admin/disputes", badge: "disputes", label: t("nav.disputes") },
    { href: "/admin/settlements", label: t("nav.settlements") },
  ];

  const shell = (
    <div className="min-h-screen pb-16">
      <header className="bg-soil text-sand px-6 py-4 flex items-center justify-between">
        <p className="font-medium">Kissaan Saathi · Admin</p>
        <div className="flex items-center gap-3">
          <NotificationBell role="admin" />
          <LanguageToggle className="flex items-center gap-1 text-sm text-sand/90" />
          <SignOutButton className="text-sm text-sand/80 underline">{t("common.logOut")}</SignOutButton>
        </div>
      </header>
      <main className="px-6 py-6">{children}</main>
      <BottomNav items={NAV_ITEMS} />
    </div>
  );

  return user ? <NotificationProvider userId={user.id}>{shell}</NotificationProvider> : shell;
}
