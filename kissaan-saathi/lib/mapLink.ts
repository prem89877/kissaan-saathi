// Builds a plain URL to open coordinates in the buyer's own maps app or
// browser. This is just a URL — not the Google Maps JavaScript/Geocoding
// API — so it needs no API key and has no usage cost.
export function directionsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}
