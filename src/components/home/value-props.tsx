import Link from "next/link";
import { Reveal } from "@/components/reveal";

type Prop = {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta?: { label: string; href: string };
};

// 24x24, stroke 1.5, currentColor — color set on parent.
const I = {
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d="M12 3l8 4v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V7l8-4Z" />
    </svg>
  ),
  card: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
    </svg>
  ),
  eye: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d="M3 17l5-5 4 3 8-9" />
      <path d="M14 6h6v6" />
    </svg>
  ),
  lines: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  ),
};

const PROPS: Prop[] = [
  {
    icon: I.shield,
    title: "Safety, every flight.",
    body: "ARGUS Platinum and Wyvern Wingman vetting on every operator. No exceptions.",
    cta: { label: "Read protocol", href: "/safety" },
  },
  {
    icon: I.card,
    title: "No hidden fees.",
    body: "All-in pricing. No fuel surcharges. No last-minute aircraft swaps. Quoted is paid.",
  },
  {
    icon: I.eye,
    title: "Absolute privacy.",
    body: "NDA-level discretion. Zero public flight visibility. Crew trained for total discretion.",
  },
  {
    icon: I.clock,
    title: "24/7 dispatch.",
    body: "Real humans. Average response under four minutes, regardless of timezone.",
    cta: { label: "Talk to dispatch", href: "/contact" },
  },
  {
    icon: I.chart,
    title: "Aircraft choice.",
    body: "Turboprops to ultra long-range. Six categories. You pick — we surface the right airframes.",
  },
  {
    icon: I.lines,
    title: "One standard.",
    body: "First flight or fiftieth, identical execution. No tier-of-the-month.",
  },
];

export function ValueProps() {
  return (
    <section className="pb-40 sm:pb-24 lg:pb-40">
      <div className="container-jn">
        <div className="mb-20 grid items-end gap-16 lg:grid-cols-[1fr_1.6fr]">
          <Reveal>
            <p className="caption">— Why JetNine</p>
          </Reveal>
          <Reveal as="h2" stagger={1} className="display-m max-w-[20ch]">
            The standard,
            <br />
            every flight.
          </Reveal>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {PROPS.map((p, i) => (
            <Reveal
              key={p.title}
              stagger={(i % 3) as 0 | 1 | 2}
              className="group rounded-[4px] border border-ink-3 bg-ink-2 p-8 transition-all duration-200 ease-out-quint hover:-translate-y-0.5 hover:border-clearance"
            >
              <div className="mb-6 text-clearance">{p.icon}</div>
              <h3 className="font-serif text-[22px] font-normal leading-[1.25] tracking-tight text-bone">
                {p.title}
              </h3>
              <p className="mt-3 text-[15px] leading-[1.55] text-bone-2">{p.body}</p>
              {p.cta ? (
                <Link
                  href={p.cta.href}
                  className="mt-6 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-bone transition-colors group-hover:text-clearance"
                >
                  {p.cta.label} <span className="arrow">→</span>
                </Link>
              ) : null}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
