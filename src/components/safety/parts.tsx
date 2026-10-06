import Image from "next/image";
import Link from "next/link";
import { EdgeHero } from "@/components/company/edge-hero";
import { SITE } from "@/lib/constants";
import { Icon, type IconName } from "@/components/company/icons";

// Shared grammar for /safety and its three sub-pages (Light - Safety):
// paper hero with the photo pinned to the right edge, the broker
// disclosure strip, the section tab bar, bordered white cards, the
// sources row, "go deeper" links and the light closing band.

/** Safety pages use the edge-photo hero. */
export const SafetyHero = EdgeHero;

export const SOURCES = {
  faa: { title: "FAA · Operator authorization", body: "How to check charter legitimacy.", link: "Open FAA guidance", url: "https://www.faa.gov/about/initiatives/safecharteroperations/thinking-chartering-aircraft" },
  dot: { title: "DOT / eCFR · Broker roles", body: "Understand roles and disclosures.", link: "Read Part 295", url: "https://www.ecfr.gov/current/title-14/chapter-II/subchapter-A/part-295" },
  nbaa: { title: "NBAA · Questions to ask", body: "Compare aircraft, operator details and written terms.", link: "Open the proposal checklist", url: "https://nbaa.org/flight-department-administration/aircraft-operating-ownership-options/aircraft-charter/request-for-proposals-aircraft-charter/" },
} as const;

/** "JetNine is a broker…" strip — carries the Part 295 line verbatim. */
export function DisclosureStrip() {
  return (
    <div className="container-jn mt-[14px]">
      <div className="flex items-center gap-3 bg-[#F0EBE2] px-4 py-[10px] text-[13px]">
        <Icon name="info" className="h-[18px] w-[18px]" strokeWidth={1.6} />
        <span>
          {SITE.legal.part295}{" "}
          <Link href="/legal#part-295" className="text-link whitespace-nowrap">
            Understand the roles →
          </Link>
        </span>
      </div>
    </div>
  );
}

export function SectionTabs({ tabs, active = 0 }: { tabs: [string, string][]; active?: number }) {
  return (
    <nav aria-label="Sections" className="mt-[14px] border-b border-line bg-white">
      <div className="container-jn flex flex-wrap justify-center gap-x-10 gap-y-0 max-sm:justify-start max-sm:gap-x-5">
        {tabs.map(([label, href], i) => (
          <a
            key={label}
            href={href}
            className={`py-3 text-[13px] text-bone ${i === active ? "font-bold shadow-[inset_0_-2px_0_var(--gold)]" : "hover:text-gold"}`}
          >
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}

export function IconDisc({ name, size = 44 }: { name: IconName; size?: number }) {
  return (
    <span className="flex flex-none items-center justify-center rounded-full bg-panel-well" style={{ width: size, height: size }}>
      <Icon name={name} className={size > 50 ? "h-[26px] w-[26px]" : "h-[22px] w-[22px]"} />
    </span>
  );
}

export function SourcesRow({ keys = ["faa", "dot", "nbaa"] }: { keys?: (keyof typeof SOURCES)[] }) {
  return (
    <section id="sources" className="container-jn scroll-mt-[var(--header-h)] pt-[26px]">
      <h2 className="font-serif text-[32px] leading-[1.1]">Independent sources. Practical answers.</h2>
      <div className="mt-[14px] grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
        {keys.map((k) => {
          const s = SOURCES[k];
          return (
            <div key={k} className="grid grid-cols-[52px_minmax(0,1fr)] gap-[14px] border border-line bg-white p-4">
              <IconDisc name="doc" size={52} />
              <div>
                <div className="font-serif text-[17px]">{s.title}</div>
                <p className="mb-2 mt-[2px] text-[12px] leading-[1.5] text-steel">{s.body}</p>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-link text-[12px]">
                  {s.link} <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[12px] text-steel">
        U.S. guidance shown. International flights may involve other authorities. Independent references; no endorsement implied.
      </p>
    </section>
  );
}

export const DEEPER = [
  { href: "/safety", h: "Safety standards", p: "The written floor, the funnel and the audit cycle behind every quote." },
  { href: "/safety/operator-vetting", h: "How we vet operators", p: "The 5,000 → 380 funnel, filter by filter — and what removes an operator once they're in." },
  { href: "/safety/pilot-standards", h: "Pilot standards", p: "Two fully licensed pilots, a 3,500-hour captain floor, 90-day currency. Who's actually flying you." },
  { href: "/safety/ratings-explained", h: "Ratings, explained", p: "What ARG/US Gold and Platinum, Wyvern Wingman, and IS-BAO Stage 2 certify in plain language." },
];

export function GoDeeper({ current }: { current: string }) {
  return (
    <section className="container-jn pt-[26px]">
      <h2 className="font-serif text-[32px] leading-[1.1]">Go deeper.</h2>
      <div className="mt-[14px] grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
        {DEEPER.filter((d) => d.href !== current).map((d) => (
          <Link key={d.href} href={d.href} className="flex flex-col border border-line bg-white p-4 transition-colors hover:border-gold">
            <span className="font-serif text-[20px]">{d.h}</span>
            <span className="mt-1 flex-1 text-[13px] leading-[1.5] text-steel">{d.p}</span>
            <span className="mt-3 text-[13px] font-bold">Read →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Light closing band over the mountain photo (Safety prototype). */
export function SafetyClose({
  title = "Clear information before you commit.",
  label = "Discuss your flight",
  href = "/quote/mission",
}: {
  title?: string;
  label?: string;
  href?: string;
}) {
  return (
    <section className="relative mt-[26px] overflow-hidden bg-navy">
      <Image src="/images/light/mountain-landscape.webp" alt="" aria-hidden fill sizes="100vw" className="object-cover opacity-75" style={{ objectPosition: "center 60%" }} />
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,rgba(247,245,240,.96)_0%,rgba(247,245,240,.9)_48%,rgba(247,245,240,.2)_100%)] max-md:bg-[rgba(247,245,240,.92)]" />
      <div className="container-jn relative flex flex-wrap items-center gap-6 py-[22px]">
        <h2 className="font-serif text-[28px] leading-[1.1] text-bone">{title}</h2>
        <Link href={href} className="btn h-[42px] border-gold bg-gold !font-bold text-white hover:bg-[#6b4c2b]">
          {label} <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}

/** Bulleted notes for the safety windows (jn-pack2 "notes" kind). */
export function WindowNotes({ items, source }: { items: string[]; source?: keyof typeof SOURCES }) {
  return (
    <div>
      <ul className="mt-4 flex list-none flex-col gap-[10px] p-0">
        {items.map((t) => (
          <li key={t} className="grid grid-cols-[18px_minmax(0,1fr)] gap-[10px] text-[15px]">
            <span aria-hidden="true" className="text-gold">✓</span>
            {t}
          </li>
        ))}
      </ul>
      {source ? (
        <p className="mt-5 border-t border-line pt-4 text-[14px]">
          <a href={SOURCES[source].url} target="_blank" rel="noopener noreferrer" className="text-link font-semibold">
            {SOURCES[source].title} ↗
          </a>
        </p>
      ) : null}
    </div>
  );
}
