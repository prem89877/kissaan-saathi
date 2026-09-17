import type { Metadata } from "next";
import { Fraunces, Work_Sans } from "next/font/google";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { getServerLang } from "@/lib/i18n/server";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["500", "600"],
});

const workSans = Work_Sans({
  subsets: ["latin"],
  variable: "--font-work-sans",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Kissaan Saathi — Farmers to Business Buyers, Directly",
  description:
    "A hyperlocal marketplace connecting farmers with nearby restaurants, hotels and dhabas.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const lang = getServerLang();

  return (
    <html lang={lang}>
      <body className={`${fraunces.variable} ${workSans.variable} font-sans bg-sand text-soil`}>
        <LanguageProvider initialLang={lang}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
