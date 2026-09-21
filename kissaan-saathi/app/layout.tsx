import type { Metadata, Viewport } from "next";
import { Fraunces, Work_Sans } from "next/font/google";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { getServerLang } from "@/lib/i18n/server";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
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
  applicationName: "Kissaan Saathi",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kissaan Saathi",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // lets safe-area-inset-* work under notches/gesture bars once installed
  themeColor: "#1F4D36", // field green — matches existing header/brand color
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
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
