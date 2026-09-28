"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/LanguageProvider";

const MIN_WITHDRAWAL = 500;

export default function WithdrawButton({ eligibleAmount }: { eligibleAmount: number }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("request_farmer_withdrawal");
    setLoading(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.refresh();
  }

  const eligible = eligibleAmount >= MIN_WITHDRAWAL;

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-alert text-sm">{error}</p>}
      <button onClick={handleClick} disabled={loading || !eligible} className="btn-primary w-full">
        {loading ? t("otp.confirming") : t("withdraw.button")}
      </button>
      {!eligible && (
        <p className="text-soil/60 text-xs">
          {t("withdraw.minNotMet").replace("{min}", String(MIN_WITHDRAWAL)).replace("{amount}", eligibleAmount.toFixed(2))}
        </p>
      )}
    </div>
  );
}
