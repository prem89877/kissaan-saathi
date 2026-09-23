import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import BottomNav from "@/components/BottomNav";
import LanguageToggle from "@/components/LanguageToggle";
import { getServerTranslator } from "@/lib/i18n/server";

export default async function DeliveryLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user?.id)
    .single();
  const { t } = getServerTranslator();

  const NAV_ITEMS = [
    { href: "/delivery/dashboard", label: t("nav.dashboard") },
    { href: "/delivery/orders", label: t("nav.orders") },
    { href: "/delivery/profile", label: t("nav.profile") },
  ];

  return (
    <div className="min-h-screen pb-16">
      <header className="bg-field text-sand px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-marigold text-xs font-medium">Kissaan Saathi · Delivery Partner</p>
          <p className="font-medium">{profile?.full_name ?? "Delivery Partner"}</p>
        </div>
        <div className="flex items-center gap-3">
          <LanguageToggle className="flex items-center gap-1 text-sm text-sand/90" />
          <SignOutButton className="text-sm text-sand/80 underline">{t("common.logOut")}</SignOutButton>
        </div>
      </header>
      <main className="px-6 py-6">{children}</main>
      <BottomNav items={NAV_ITEMS} />
    </div>
  );
}
