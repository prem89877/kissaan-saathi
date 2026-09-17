import Link from "next/link";
import { getServerTranslator } from "@/lib/i18n/server";
import LanguageToggle from "@/components/LanguageToggle";

export default function LandingPage() {
  const { t } = getServerTranslator();

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="px-6 pt-14 pb-10 bg-field text-sand">
        <div className="flex justify-between items-start mb-2">
          <p className="text-marigold font-medium">{t("landing.brand")}</p>
          <LanguageToggle className="flex items-center gap-1 text-sm text-sand" />
        </div>
        <h1 className="font-display text-4xl leading-tight mb-4">
          {t("landing.heroTitle")}
        </h1>
        <p className="text-sand/85 mb-8 max-w-md">
          {t("landing.heroSubtitle")}
        </p>
        <div className="flex flex-col gap-3">
          <Link href="/signup/farmer" className="btn-primary bg-marigold text-soil text-center active:bg-marigold-dark">
            {t("landing.joinFarmer")}
          </Link>
          <Link href="/signup/buyer" className="btn-secondary border-sand text-sand text-center active:bg-field-dark">
            {t("landing.joinBuyer")}
          </Link>
        </div>
        <p className="text-sand/70 text-sm mt-6">
          {t("landing.alreadyHaveAccount")}{" "}
          <Link href="/login" className="underline">{t("common.logIn")}</Link>
        </p>
      </section>

      {/* How it works */}
      <section className="px-6 py-10">
        <h2 className="font-display text-2xl text-field mb-6">{t("landing.howItWorks")}</h2>

        <div className="mb-8">
          <h3 className="font-medium text-field mb-3">{t("landing.forFarmers")}</h3>
          <ol className="space-y-2 text-soil/90">
            <li>1. Register and add your farm details.</li>
            <li>2. List your produce with photos, price and quantity.</li>
            <li>3. An admin reviews the listing before it goes live.</li>
            <li>4. Nearby restaurants, hotels and dhabas discover it.</li>
            <li>5. Negotiate price and quantity directly, on the platform.</li>
            <li>6. Pack the order and photograph it as evidence.</li>
            <li>7. Choose Kissaan Saathi Delivery or let the buyer pick up.</li>
            <li>8. Get paid, minus a transparent 5% platform fee.</li>
          </ol>
        </div>

        <div>
          <h3 className="font-medium text-field mb-3">{t("landing.forBuyers")}</h3>
          <ol className="space-y-2 text-soil/90">
            <li>1. Register your restaurant, hotel or dhaba.</li>
            <li>2. Browse admin-reviewed listings near you.</li>
            <li>3. Compare price, grade, harvest date and distance.</li>
            <li>4. Negotiate directly with the farmer.</li>
            <li>5. Place a structured order with fees shown upfront.</li>
            <li>6. Review packing-stage photos before delivery.</li>
            <li>7. Receive and inspect the produce.</li>
            <li>8. Raise a dispute if something's materially wrong.</li>
          </ol>
        </div>
      </section>

      <section className="px-6 py-10 bg-sand-dark">
        <h2 className="font-display text-2xl text-field mb-3">{t("landing.nothingHidden")}</h2>
        <p className="text-soil/90 mb-2">
          Every order shows the product amount, delivery charge, buyer fee and
          total separately — before you confirm. Every listing marked{" "}
          <span className="text-marigold font-medium">Admin Reviewed</span>{" "}
          has been checked by our team, though that isn't a guarantee of
          quality or quantity — it's a review step, backed by photo evidence
          at listing and packing stage.
        </p>
      </section>

      <footer className="px-6 py-8 text-sm text-soil/70 flex gap-4">
        <Link href="/terms">Terms &amp; Conditions</Link>
        <Link href="/privacy">Privacy Policy</Link>
      </footer>
    </main>
  );
}
