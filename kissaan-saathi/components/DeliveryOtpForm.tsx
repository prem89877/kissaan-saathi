"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/LanguageProvider";

// Delivery partner enters the code read out by the farmer (purpose
// "pickup") or the buyer (purpose "delivery"). The actual check happens
// entirely server-side in verify_pickup_otp / verify_delivery_otp — this
// component never sees or validates the real code itself, it only submits
// a guess and shows whatever the RPC says.
export default function DeliveryOtpForm({
  orderId,
  purpose,
}: {
  orderId: string;
  purpose: "pickup" | "delivery";
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc(
      purpose === "pickup" ? "verify_pickup_otp" : "verify_delivery_otp",
      { p_order_id: orderId, p_code: code.trim() }
    );
    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setCode("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card border-field flex flex-col gap-2">
      <p className="font-medium text-field text-sm">
        {purpose === "pickup" ? t("otp.enterPickupTitle") : t("otp.enterDeliveryTitle")}
      </p>
      {error && <p className="text-alert text-sm">{error}</p>}
      <input
        className="input-field"
        inputMode="numeric"
        maxLength={6}
        placeholder={t("otp.codePlaceholder")}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
      />
      <button type="submit" disabled={submitting || code.length !== 6} className="btn-primary w-full">
        {submitting
          ? t("otp.confirming")
          : purpose === "pickup"
          ? t("otp.confirmPickup")
          : t("otp.confirmDelivery")}
      </button>
    </form>
  );
}
