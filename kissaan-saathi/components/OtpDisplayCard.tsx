import type { TranslationKey } from "@/lib/i18n/dictionary";

// Server-rendered display of the buyer/farmer's own OTP row (RLS already
// guarantees the query that fetched `otp` could only return their own
// purpose — see 17_delivery_otp.sql order_otps_select_farmer /
// order_otps_select_buyer policies). Pure display, no client JS needed.
export default function OtpDisplayCard({
  purpose,
  otp,
  t,
}: {
  purpose: "pickup" | "delivery";
  otp: { code: string; expires_at: string; verified_at: string | null } | null | undefined;
  t: (key: TranslationKey) => string;
}) {
  if (!otp) return null;

  const expired = !otp.verified_at && new Date(otp.expires_at).getTime() < Date.now();

  return (
    <div className="card border-marigold">
      <p className="font-medium text-soil text-sm">
        {purpose === "pickup" ? t("otp.pickupTitle") : t("otp.deliveryTitle")}
      </p>
      {otp.verified_at ? (
        <p className="text-field font-medium mt-1">{t("otp.verified")}</p>
      ) : expired ? (
        <p className="text-alert text-sm mt-1">{t("otp.expired")}</p>
      ) : (
        <>
          <p className="font-display text-3xl text-marigold-dark tracking-widest mt-1">{otp.code}</p>
          <p className="text-soil/60 text-xs mt-1">
            {purpose === "pickup" ? t("otp.pickupHelp") : t("otp.deliveryHelp")}
          </p>
        </>
      )}
    </div>
  );
}
