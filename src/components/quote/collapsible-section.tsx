"use client";

// Collapsed optional group on the aircraft step, in the Light panel: a
// 1px line box whose header button carries the title, a one-line summary
// of the current selection and "Show ▾ / Hide ▴". Several can be open at
// once; the parent owns the state.
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
    <section className="overflow-hidden rounded-[3px] border border-line bg-surface">
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex min-h-[52px] w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-ink"
        >
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold leading-[1.35] text-bone">{title}</span>
            <span className="mt-0.5 block text-[13px] text-steel">{summary}</span>
          </span>
          <span className="flex-none text-[13px] text-steel underline underline-offset-[3px]">
            {open ? "Hide" : "Show"}
          </span>
        </button>
      </h3>
      {open ? (
        <div id={bodyId} className="border-t border-line-faint px-4 pb-4 pt-3.5">
          {children}
        </div>
      ) : null}
    </section>
  );
}
