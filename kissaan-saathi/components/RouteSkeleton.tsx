// Generic route-level loading skeleton, styled with the same tokens as the
// rest of the app (card / rounded-card / soil / field) so it never reads as
// a foreign "loading spinner" bolted onto the design. Used by the
// loading.tsx files below — Next.js shows this automatically while a page's
// server data is still being fetched, instead of a blank white screen.
export default function RouteSkeleton() {
  return (
    <div className="animate-pulse" aria-hidden="true">
      <div className="h-7 w-40 bg-soil/10 rounded-card mb-6" />

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="card">
          <div className="h-8 w-10 bg-soil/10 rounded mb-2" />
          <div className="h-3 w-20 bg-soil/10 rounded" />
        </div>
        <div className="card">
          <div className="h-8 w-10 bg-soil/10 rounded mb-2" />
          <div className="h-3 w-24 bg-soil/10 rounded" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card">
            <div className="flex justify-between items-start mb-2">
              <div className="h-4 w-32 bg-soil/10 rounded" />
              <div className="h-4 w-16 bg-soil/10 rounded-full" />
            </div>
            <div className="h-3 w-48 bg-soil/10 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
