import { cookies } from "next/headers";
import { translate, type Lang, type TranslationKey } from "./dictionary";

export function getServerLang(): Lang {
  const cookieLang = cookies().get("lang")?.value;
  return cookieLang === "mr" ? "mr" : "en";
}

// Usable directly inside Server Component page/layout files — no "use client"
// needed, since this just reads a cookie and looks up plain data.
export function getServerTranslator() {
  const lang = getServerLang();
  return { lang, t: (key: TranslationKey) => translate(lang, key) };
}
