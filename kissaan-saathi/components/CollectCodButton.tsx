"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n/LanguageProvider";

export default function CollectCodButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/delivery/collect-cod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? t("cod.collectFailed"));
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError(t("cod.collectFailed"));
      setLoading(false);
    }
  }

  return (
    <div className="card border-marigold flex flex-col gap-2">
      <p className="text-sm text-soil">{t("cod.collectPrompt")}</p>
      {error && <p className="text-alert text-sm">{error}</p>}
      <button onClick={handleClick} disabled={loading} className="btn-primary w-full">
        {loading ? t("otp.confirming") : t("cod.collectButton")}
      </button>
    </div>
  );
}
