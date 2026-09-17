import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import BottomNav from "@/components/BottomNav";
import LanguageToggle from "@/components/LanguageToggle";
import { getServerTranslator } from "@/lib/i18n/server";

export default async function BuyerLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: buyer } = await supabase
    .from("buyer_profiles")
    .select("business_name")
    .eq("user_id", user?.id)
    .single();
  const { t } = getServerTranslator();

  const NAV_ITEMS = [
    { href: "/buyer/dashboard", label: t("nav.dashboard") },
    { href: "/buyer/marketplace", label: t("nav.marketplace") },
    { href: "/buyer/chats", label: t("nav.chats") },
    { href: "/buyer/orders", label: t("nav.orders") },
    { href: "/buyer/profile", label: t("nav.profile") },
  ];

  return (
    <div className="min-h-screen pb-16">
      <header className="bg-field text-sand px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-marigold text-xs font-medium">Kissaan Saathi · Buyer</p>
          <p className="font-medium">{buyer?.business_name ?? "Business"}</p>
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
