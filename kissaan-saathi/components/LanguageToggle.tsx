"use client";

import { useTranslation } from "@/lib/i18n/LanguageProvider";

export default function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang } = useTranslation();

  return (
    <div className={className ?? "flex items-center gap-1 text-sm"}>
      <button
        onClick={() => setLang("en")}
        className={`px-2 py-1 min-h-[32px] rounded ${lang === "en" ? "font-semibold underline" : "opacity-60"}`}
        aria-pressed={lang === "en"}
      >
        EN
      </button>
      <span className="opacity-40">|</span>
      <button
        onClick={() => setLang("mr")}
        className={`px-2 py-1 min-h-[32px] rounded ${lang === "mr" ? "font-semibold underline" : "opacity-60"}`}
        aria-pressed={lang === "mr"}
      >
        मराठी
      </button>
    </div>
  );
}
