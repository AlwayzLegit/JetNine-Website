// Skeleton for the force-dynamic account pages — a slow query otherwise
// leaves the member staring at the rail with no feedback. Mirrors the
// overview's shape: title, sentence, the upcoming-trip card and two rows.
export default function AccountLoading() {
  return (
    <div aria-busy="true" aria-label="Loading your account">
      <div className="h-11 w-72 max-w-full animate-pulse rounded-control bg-surface-2" />
      <div className="mt-3 h-5 w-96 max-w-full animate-pulse rounded-control bg-surface-2" />
      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <div className="h-4 w-28 animate-pulse rounded-control bg-surface-2" />
          <div className="card mt-2.5 h-64 animate-pulse" />
          <div className="mt-7 h-4 w-48 animate-pulse rounded-control bg-surface-2" />
          <div className="card mt-2.5 h-20 animate-pulse" />
          <div className="mt-7 h-4 w-24 animate-pulse rounded-control bg-surface-2" />
          <div className="card mt-2.5 h-40 animate-pulse" />
        </div>
        <div className="flex flex-col gap-4">
          <div className="card h-48 animate-pulse" />
          <div className="card h-32 animate-pulse" />
          <div className="card h-40 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
