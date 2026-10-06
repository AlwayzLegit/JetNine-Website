import Link from "next/link";

/** Slim navy closing strip from the journal board. */
export function JournalCtaStrip({
  title = "Turn your research into a flight plan.",
  body = "Share your route, dates, passengers and priorities.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <section className="on-navy bg-navy">
      <div className="container-jn flex flex-wrap items-center gap-6 py-[22px]">
        <h2 className="font-serif text-[26px] font-normal">{title}</h2>
        <span aria-hidden="true" className="h-7 w-px bg-[rgba(255,255,255,0.3)] max-md:hidden" />
        <span className="flex-1 basis-[220px] text-[14px] text-navy-on-2">{body}</span>
        <Link
          href="/quote/mission"
          className="inline-flex h-10 items-center gap-[10px] rounded-control bg-surface-2 px-[18px] text-[13px] font-bold !text-bone hover:bg-white"
        >
          Request a quote <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </section>
  );
}
