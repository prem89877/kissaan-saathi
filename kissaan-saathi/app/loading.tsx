// Covers "/" and "/login" (both check the session server-side before
// deciding what to render, so both do a brief bit of server work first).
// Without this, that moment was a blank white screen — the same
// "no blank white screen" rule the rest of the app now follows.
export default function RootLoading() {
  return (
    <div className="min-h-screen bg-field flex items-center justify-center" aria-hidden="true">
      <p className="text-marigold font-medium animate-pulse">Kissaan Saathi</p>
    </div>
  );
}
