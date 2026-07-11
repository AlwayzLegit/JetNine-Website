// Skeleton for the force-dynamic account pages — a slow query otherwise
// leaves the member staring at a blank navigation with no feedback.
export default function AccountLoading() {
  return (
    <section className="container-jn py-12" aria-busy="true" aria-label="Loading your account">
      <div className="mb-10 flex flex-col gap-4">
        <div className="h-3 w-40 animate-pulse rounded-[2px] bg-ink-3" />
        <div className="h-10 w-72 animate-pulse rounded-[3px] bg-ink-3" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded-[2px] bg-ink-3" />
      </div>
      <div className="grid grid-cols-1 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-[4px] border border-ink-3 bg-ink-2" />
        ))}
      </div>
    </section>
  );
}
