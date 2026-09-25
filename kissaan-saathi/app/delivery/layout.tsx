import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/auth/session";
import SignOutButton from "@/components/SignOutButton";
import BottomNav from "@/components/BottomNav";
import LanguageToggle from "@/components/LanguageToggle";
import NotificationProvider from "@/components/notifications/NotificationProvider";
import NotificationBell from "@/components/notifications/NotificationBell";
import { getServerTranslator } from "@/lib/i18n/server";

export default async function DeliveryLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  // middleware.ts already verified this user for this exact request — reuse
  // that instead of calling supabase.auth.getUser() again here.
  const userId = await requireUserId();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .single();
  const { t } = getServerTranslator();

  const NAV_ITEMS = [
    { href: "/delivery/dashboard", badge: "dashboard", label: t("nav.dashboard") },
    { href: "/delivery/orders", badge: "orders", label: t("nav.orders") },
    { href: "/delivery/profile", label: t("nav.profile") },
  ];

  const shell = (
    <div className="min-h-screen pb-16">
      <header className="bg-field text-sand px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-marigold text-xs font-medium">Kissaan Saathi · Delivery Partner</p>
          <p className="font-medium">{profile?.full_name ?? "Delivery Partner"}</p>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell role="delivery" />
          <LanguageToggle className="flex items-center gap-1 text-sm text-sand/90" />
          <SignOutButton className="text-sm text-sand/80 underline">{t("common.logOut")}</SignOutButton>
        </div>
      </header>
      <main className="px-6 py-6">{children}</main>
      <BottomNav items={NAV_ITEMS} />
    </div>
  );

  return <NotificationProvider userId={userId}>{shell}</NotificationProvider>;
}
