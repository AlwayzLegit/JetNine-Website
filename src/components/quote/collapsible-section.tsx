"use client";

// Collapsed optional group on the aircraft step: a card whose header
// button carries the title, a one-line summary of the current selection
// and "Show ▼ / Hide ▲". Several can be open at once (the prototype's
// `open{}` map); the parent owns the state.
type Props = {
  id: string;
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

export function CollapsibleSection({ id, title, summary, open, onToggle, children }: Props) {
  const bodyId = `${id}-body`;
  return (
    <section className="card overflow-hidden">
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex min-h-[56px] w-full items-center justify-between gap-4 px-6 py-[18px] text-left transition-colors hover:bg-surface-2/40 max-md:px-4"
        >
          <span className="min-w-0">
            <span className="block text-[18px] font-medium leading-[1.3] text-bone">{title}</span>
            <span className="mt-0.5 block text-[14px] text-steel">{summary}</span>
          </span>
          <span className="flex-none text-[14px] text-bone-2">{open ? "Hide ▲" : "Show ▼"}</span>
        </button>
      </h3>
      {open ? (
        <div id={bodyId} className="px-6 pb-6 max-md:px-4">
          {children}
        </div>
      ) : null}
    </section>
  );
}
