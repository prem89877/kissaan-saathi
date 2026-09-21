import type { MetadataRoute } from "next";

// Next.js serves this at /manifest.webmanifest and auto-injects the
// <link rel="manifest"> tag in <head> — no separate public/manifest.json
// needed, and nothing in app/layout.tsx has to reference this by hand.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kissaan Saathi",
    short_name: "Kissaan Saathi",
    description:
      "A hyperlocal marketplace connecting farmers with nearby restaurants, hotels and dhabas.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FBF7EE", // matches the sand background + logo's own backdrop
    theme_color: "#1F4D36", // matches the field-green brand color used across headers
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/maskable-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
