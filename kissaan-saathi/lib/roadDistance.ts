import { distanceKm } from "@/lib/distance";

// Free, no API key: OSRM's public demo routing server. This is a shared
// community server meant for light/evaluation use, not guaranteed uptime at
// production scale — if it becomes unreliable once order volume grows, the
// fix is self-hosting OSRM (still free, just needs a small always-on
// server), not switching to a paid Maps API.
const OSRM_BASE_URL = "https://router.project-osrm.org/route/v1/driving";

// One-way road distance in km, via OSRM. Falls back to the straight-line
// (haversine) distance if OSRM is unreachable, slow, or finds no road route
// — so pricing never breaks just because the routing server had a bad
// moment, it just gets a little less precise for that one call.
export async function roadDistanceKm(
  lat1: number | null,
  lng1: number | null,
  lat2: number | null,
  lng2: number | null
): Promise<number | null> {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;

  try {
    const url = `${OSRM_BASE_URL}/${lng1},${lat1};${lng2},${lat2}?overview=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`OSRM returned ${res.status}`);
    const data = await res.json();
    const meters = data?.routes?.[0]?.distance;
    if (typeof meters !== "number") throw new Error("No route found");
    return Math.round((meters / 1000) * 10) / 10;
  } catch {
    return distanceKm(lat1, lng1, lat2, lng2);
  }
}
