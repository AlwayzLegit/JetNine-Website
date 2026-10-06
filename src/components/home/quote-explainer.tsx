import Link from "next/link";

const PARTS = [
  { label: "Aircraft and flight costs", d: "M21 3L3 10.5l7.5 3L13.5 21 21 3zM10.5 13.5L21 3" },
  { label: "Airport and handling fees", d: "M3 10l9-6 9 6H3zM5 10v8M9 10v8M15 10v8M19 10v8M3 18h18v3H3z" },
  { label: "Taxes and included services", d: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6" },
  {
    label: "Any optional extras, clearly identified",
    d: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  },
];

/** "Know what goes into your quote." — copy left, itemized sand card right. */
export function QuoteExplainer() {
  return (
    <section id="quote" className="container-jn grid items-center gap-12 pt-12 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
      <div>
        <p className="eyebrow">Clarity from the start</p>
        <h2 className="title-section !text-[clamp(34px,9vw,46px)]">
          Know what goes
          <br />
          into your quote.
        </h2>
        <p className="mt-4 max-w-[44ch] font-serif text-[17px] leading-[1.5]">
          Aircraft, route, timing and your needs all shape the price. Understand the details before you decide.
        </p>
        <Link href="/guides/private-jet-charter-cost" className="rule-link mt-[18px] !text-[16px]">
          Understand charter pricing <span className="arrow-sm" aria-hidden="true">↗</span>
        </Link>
      </div>
      <div className="bg-surface-2 px-6 pb-[18px] pt-6">
        <p className="eyebrow !mb-[6px]">Your quote, explained</p>
        <ul className="m-0 list-none p-0">
          {PARTS.map((p) => (
            <li key={p.label} className="flex items-center gap-[14px] border-t border-line py-3 font-serif text-[16px]">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-[22px] w-[22px] flex-none">
                <path d={p.d} />
              </svg>
              {p.label}
            </li>
          ))}
        </ul>
        <p className="mt-[10px] text-[12px] text-steel">Availability and final terms confirmed with your quote.</p>
      </div>
    </section>
  );
}
