import Image from "next/image";
import Link from "next/link";
import { WindowButton } from "@/components/light/window";
import { ICONS, Icon, SOURCE_URLS } from "./icons";

/* Shared bands of Light - Routes, used by the hub and every route page. */

const BEFORE = [
  { title: "Your travel dates", body: "Help us match the right aircraft and options.", d: ICONS.calendar },
  { title: "Passenger and baggage needs", body: "Share the number of passengers and any special items.", d: ICONS.people },
  { title: "Preferred airport or final address", body: "Tell us your preferred airport or final destination.", d: ICONS.pin },
];

/** "Before you request" aside card with the cabin photo. */
export function BeforeYouRequest() {
  return (
    <div className="border border-line bg-white px-5 py-4">
      <h3 className="font-serif text-[20px]">Before you request</h3>
      {BEFORE.map((b) => (
        <div key={b.title} className="grid grid-cols-[26px_minmax(0,1fr)] items-start gap-3 border-t border-line py-[9px] first-of-type:mt-2">
          <Icon d={b.d} />
          <span>
            <b className="block text-[13px]">{b.title}</b>
            <span className="text-[12px] text-steel">{b.body}</span>
          </span>
        </div>
      ))}
      <div className="relative mt-2 aspect-video overflow-hidden bg-surface-2">
        <Image src="/images/light/cabin-supermid.webp" alt="" fill sizes="(max-width: 768px) 100vw, 400px" className="object-cover" />
      </div>
      <div className="mt-[10px] text-center">
        <Link href="/aircraft" className="text-[13px] font-bold text-gold">
          Compare aircraft <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}

const AIRPORT_ROWS = [
  ["Your final address", "Ground travel is part of the journey."],
  ["Aircraft and baggage", "Airport and aircraft must suit the load."],
  ["Operating conditions", "Hours, weather and access can affect plans."],
  ["International arrivals", "Confirm customs and entry procedures."],
];

const TERMINAL_ROWS = [
  { d: ICONS.city, t: "Private terminal name and address", b: "To be confirmed" },
  { d: ICONS.doc, t: "Arrival instructions", b: "Provided with your trip details" },
  { d: ICONS.pin, t: "Ground transfer", b: "Share your final destination" },
];

/**
 * "The best airport depends on the whole trip." — compare table plus the
 * departure-terminal card, which opens the terminal drawer. `airport` and
 * `links` let a route page name its own departure field.
 */
export function AirportBand({
  title = "The best airport depends on the whole trip.",
  airport = "Van Nuys · VNY",
  links = [
    { label: "Van Nuys private terminal directory", href: SOURCE_URLS.vny },
    { label: "Teterboro official airport information", href: SOURCE_URLS.teb },
  ],
  rows,
}: {
  title?: string;
  airport?: string;
  links?: { label: string; href: string }[];
  /** Extra leading rows, e.g. the lane's own airports. */
  rows?: [string, string][];
}) {
  const drawer = (
    <>
      <div className="relative mt-3 aspect-[16/8] overflow-hidden bg-surface-2">
        <Image src="/images/light/airport-fbo.webp" alt="" fill sizes="440px" className="object-cover" />
      </div>
      <p className="mt-[10px] font-serif text-[16px]">Example airport: {airport}</p>
      <p className="mt-[2px] text-[12px] text-steel">Private terminal selection will be confirmed for your trip.</p>
      <div className="mt-3 flex flex-col gap-2">
        {TERMINAL_ROWS.map((r) => (
          <div key={r.t} className="grid grid-cols-[24px_minmax(0,1fr)] items-center gap-[10px] rounded-[3px] border border-line bg-ink px-3 py-[10px]">
            <Icon d={r.d} className="h-5 w-5" />
            <span>
              <b className="block text-[13px]">{r.t}</b>
              <span className="text-[12px] text-steel">{r.b}</span>
            </span>
          </div>
        ))}
      </div>
      {links.length > 0 ? (
        <>
          <p className="mb-[6px] mt-[14px] text-[12px] font-bold">Airport resources</p>
          <div className="flex flex-col gap-[6px]">
            {links.map((l) => (
              <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-[3px] border border-line px-3 py-2 text-[13px] font-bold">
                <Icon d={ICONS.globe} className="h-4 w-4" />
                {l.label} <span aria-hidden="true">↗</span>
              </a>
            ))}
          </div>
        </>
      ) : null}
      <p className="mt-3 text-[12px] text-steel">Use the terminal address on your confirmed itinerary.</p>
      <Link href="/quote/mission" className="btn btn-primary mt-3 w-full">
        Add ground transfer needs <span aria-hidden="true">→</span>
      </Link>
    </>
  );
  const allRows = [...(rows ?? []), ...AIRPORT_ROWS];

  return (
    <section className="mt-[26px] border-y border-line bg-surface">
      <div className="container-jn pb-6 pt-[22px]">
        <h2 className="font-serif text-[28px] leading-[1.1]">{title}</h2>
        <div className="mt-3 grid items-start gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
          <div className="border border-line bg-white text-[13px]">
            <div className="grid gap-x-3 gap-y-1 bg-surface-2 px-[14px] py-2 text-[12px] font-bold [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]">
              <span>What to compare</span>
              <span>Why it matters</span>
            </div>
            {allRows.map(([a, b]) => (
              <div key={a} className="grid gap-x-3 gap-y-1 border-t border-line px-[14px] py-[9px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]">
                <span className="font-bold">{a}</span>
                <span className="text-steel">{b}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-4 border border-line bg-white p-[14px]">
            <div className="relative aspect-[4/3] min-w-0 max-w-full flex-[1_1_150px] overflow-hidden bg-surface-2">
              <Image src="/images/light/black-suv-glass-terminal.webp" alt="" fill sizes="240px" className="object-cover" />
            </div>
            <div className="min-w-0 flex-[999_1_240px]">
              <b className="block text-[15px]">Confirm your departure terminal</b>
              <span className="mb-2 mt-1 block text-[12px] text-steel">
                Private flights usually leave from a private terminal (called an FBO). Use the address on your trip confirmation.
              </span>
              <WindowButton
                label={
                  <>
                    Private terminal checklist <span aria-hidden="true">↗</span>
                  </>
                }
                className="border-0 bg-transparent p-0 text-[12px] font-bold underline underline-offset-[3px]"
                title="Confirm your departure terminal"
                variant="drawer"
              >
                {drawer}
              </WindowButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Navy band: "A route guide starts the conversation." */
export function RouteGuideBand() {
  return (
    <section className="on-navy relative overflow-hidden bg-navy">
      <Image src="/images/light/jet-ultra-flight.webp" alt="" aria-hidden fill sizes="100vw" className="object-cover opacity-50" />
      <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(90deg,rgba(18,35,46,.98) 0%,rgba(18,35,46,.9) 55%,rgba(18,35,46,.3) 100%)" }} />
      <div className="container-jn relative py-[26px]">
        <h2 className="font-serif text-[28px] leading-[1.1] text-white">A route guide starts the conversation.</h2>
        <p className="mt-[6px] max-w-[60ch] text-[14px] text-navy-on-2">
          Flight time, nonstop capability and total price depend on the specific aircraft, load, date and operating conditions.
        </p>
        <div className="mt-[14px] flex flex-wrap gap-[10px]">
          <Link href="/aircraft" className="btn btn-on-navy h-10 px-4 text-[13px]">
            Compare aircraft <span aria-hidden="true">→</span>
          </Link>
          <Link href="/guides/private-jet-charter-cost" className="btn h-10 border-white bg-transparent px-4 text-[13px] font-bold text-white hover:bg-[rgba(255,255,255,0.08)] hover:text-white">
            Understand charter costs <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

const SOURCES = [
  {
    d: ICONS.shield,
    title: "FAA · Verify the operator",
    body: "Ask for carrier certification and aircraft charter authorization.",
    detail: "Confirm the operating carrier’s name, its FAA air carrier certificate and that the aircraft is authorized for on-demand charter.",
    link: "Read charter guidance",
    open: "Open FAA charter guidance",
    href: SOURCE_URLS.faa,
  },
  {
    d: ICONS.doc,
    title: "CBP · U.S. international arrivals",
    body: "Review customs processing with your operating carrier.",
    detail: "General aviation arrivals follow U.S. Customs and Border Protection procedures. Your operating carrier coordinates the arrival airport and timing.",
    link: "General aviation guidance",
    open: "Open CBP guidance",
    href: SOURCE_URLS.cbp,
  },
  {
    d: ICONS.globe,
    title: "U.S. Department of State",
    body: "Check destination entry requirements and advisories for U.S. travelers.",
    detail: "Check destination guidance for U.S. travelers. Confirm requirements for each traveler’s nationality and itinerary.",
    link: "Destination information",
    open: "Open official destination guidance",
    href: SOURCE_URLS.state,
  },
];

/** "Helpful sources for your route." — three cards, each opening its source window. */
export function RouteSources() {
  return (
    <section className="container-jn pt-6">
      <h2 className="font-serif text-[28px] leading-[1.1]">Helpful sources for your route.</h2>
      <div className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
        {SOURCES.map((s) => (
          <div key={s.title} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 border border-line bg-surface px-4 py-[14px]">
            <Icon d={s.d} className="h-[26px] w-[26px]" />
            <div>
              <b className="block text-[14px]">{s.title}</b>
              <span className="mb-2 mt-[2px] block text-[12px] text-steel">{s.body}</span>
              <WindowButton
                label={
                  <>
                    {s.link} <span aria-hidden="true">↗</span>
                  </>
                }
                className="border-0 bg-transparent p-0 text-left text-[13px] font-bold underline decoration-line underline-offset-4"
                title={s.title}
                sub="Independent guidance. No endorsement implied."
              >
                <p className="mt-4 text-[14px] leading-[1.5]">{s.detail}</p>
                <a href={s.href} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm mt-4">
                  {s.open} <span aria-hidden="true">↗</span>
                </a>
              </WindowButton>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-[6px] text-right text-[12px] text-steel">Independent references. No endorsement implied.</p>
    </section>
  );
}

/**
 * Small ruled accordion from the prototype ("Good questions before you
 * fly."): native <details>, first one open, answers stay in the HTML.
 */
export function RouteFaq({
  title,
  items,
  aside,
}: {
  title: string;
  items: { q: string; a: string }[];
  aside?: React.ReactNode;
}) {
  return (
    <section className="container-jn grid items-start gap-7 pt-[22px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
      <div>
        <h2 className="font-serif text-[28px] leading-[1.1]">{title}</h2>
        <div className="mt-[10px] border border-line bg-surface px-4">
          {items.map((f, i) => (
            <details key={f.q} open={i === 0} className="group border-t border-line first:border-t-0">
              <summary className="flex cursor-pointer list-none items-center gap-3 py-[11px] text-[13px] font-bold [&::-webkit-details-marker]:hidden">
                <span aria-hidden="true" className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border border-gold text-[12px] text-gold">
                  <span className="group-open:hidden">+</span>
                  <span className="hidden group-open:inline">−</span>
                </span>
                <span>{f.q}</span>
              </summary>
              <p className="pb-3 pl-[30px] text-[13px] leading-[1.5] text-steel">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
      {aside ?? (
        <div className="flex flex-col gap-[10px] pt-11 text-[13px] max-md:pt-0">
          <Link href="/how-it-works" className="font-bold text-gold">How booking works <span aria-hidden="true">→</span></Link>
          <Link href="/guides" className="font-bold text-gold">Private jet charter guides <span aria-hidden="true">→</span></Link>
          <Link href="/private-jet-charter" className="font-bold text-gold">Browse charter by city <span aria-hidden="true">→</span></Link>
        </div>
      )}
    </section>
  );
}
