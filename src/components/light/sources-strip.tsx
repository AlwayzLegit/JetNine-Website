import { WindowButton } from "./window";

export type Source = {
  /** Organisation, e.g. "FAA · United States". */
  name: string;
  body: string;
  linkLabel: string;
  href: string;
};

const ICON = "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6";

/**
 * "Sources & further guidance" strip (jn-light-chrome.js <jn-sources>): a
 * sand band of underlined source names, each opening the sources drawer,
 * with the no-endorsement note on the right.
 */
export function SourcesStrip({
  sources,
  note = "Guidance is jurisdiction-specific. These organizations do not endorse JetNine.",
  drawerSub = "Read the original advice behind this guide.",
}: {
  sources: Source[];
  note?: string;
  drawerSub?: string;
}) {
  const drawer = (
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

  return (
    <div className="border-t border-line bg-surface-2">
      <div className="container-jn flex flex-wrap items-center gap-x-[18px] gap-y-2 py-[14px] text-[13px] text-steel">
        <span className="mr-[6px] font-semibold text-bone">Sources &amp; further guidance</span>
        {sources.map((s, i) => (
          <span key={s.name} className="flex items-center gap-[18px]">
            <WindowButton
              label={
                <>
                  {s.name} <span aria-hidden="true">↗</span>
                </>
              }
              className="text-link border-0 bg-transparent p-0 text-[13px] font-semibold"
              title="Sources & useful guidance"
              sub={drawerSub}
              variant="drawer"
            >
              {drawer}
            </WindowButton>
            {i < sources.length - 1 ? <span aria-hidden="true" className="text-line">|</span> : null}
          </span>
        ))}
        <span className="ml-auto max-w-[34ch] text-right text-[12px] max-md:ml-0 max-md:text-left">{note}</span>
      </div>
    </div>
  );
}
