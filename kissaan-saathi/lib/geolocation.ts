// Thin wrapper around the browser's native Geolocation API. No paid
// geocoding/maps API involved — this only ever reads navigator.geolocation.

export type GeoOutcome =
  | { ok: true; latitude: number; longitude: number }
  | { ok: false; reason: "denied" | "unavailable" };

export function isGeolocationSupported(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

export function getCurrentPosition(): Promise<GeoOutcome> {
  return new Promise((resolve) => {
    if (!isGeolocationSupported()) {
      resolve({ ok: false, reason: "unavailable" });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({ ok: true, latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      (err) => {
        // code 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
        resolve({ ok: false, reason: err.code === 1 ? "denied" : "unavailable" });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}
