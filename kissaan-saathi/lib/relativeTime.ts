// lib/relativeTime.ts
// Small formatting helper for "Updated 12 seconds ago" style labels.
// No dependency added — plain Intl.RelativeTimeFormat-free implementation
// since this only needs coarse, short output.
export function timeAgoLabel(isoTimestamp: string, nowMs: number = Date.now()): string {
  const then = new Date(isoTimestamp).getTime();
  const diffSec = Math.max(0, Math.round((nowMs - then) / 1000));

  if (diffSec < 5) return "Updated just now";
  if (diffSec < 60) return `Updated ${diffSec} sec ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `Updated ${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  return `Updated ${diffHr} hr ago`;
}