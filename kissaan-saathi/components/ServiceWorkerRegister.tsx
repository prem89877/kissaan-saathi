"use client";

import { useEffect } from "react";

// Registered only in production so `next dev`'s hot reload is never
// affected by a stale cached service worker during development.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installability/offline support degrading silently is fine —
      // the site must keep working exactly as before either way.
    });
  }, []);

  return null;
}
