import type { Source } from "@/components/light/sources-strip";

const ICON = "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6";

/**
 * Body of the "Sources & useful guidance" drawer, for in-page triggers
 * ("View sources ↗") that open the same list the SourcesStrip opens.
 * Mirrors the strip's drawer markup (that one is internal to the strip).
 */
export function SourcesBody({ sources, note }: { sources: Source[]; note: string }) {
  return (
    <>
      <div className="mt-2">
        {sources.map((s) => (
          <div key={s.name} className="grid grid-cols-[36px_minmax(0,1fr)] gap-[14px] border-b border-line py-5">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-[30px] w-[30px]">
              <path d={ICON} />
            </svg>
            <div>
              <h3 className="font-serif text-[20px] leading-[1.2]">{s.name}</h3>
              <p className="mb-2 mt-1 text-[14px] text-steel">{s.body}</p>
              <a href={s.href} target="_blank" rel="noopener noreferrer" className="text-link text-[14px] font-semibold">
                {s.linkLabel} <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[12px] text-steel">{note}</p>
    </>
  );
}
