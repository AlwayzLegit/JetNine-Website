import Image from "next/image";
import Link from "next/link";

// Sections from Light - Private charter, shared by the city hub and the
// 29 city pages.

const BRIEF = ["Departure and arrival points", "Dates and preferred local times", "Passengers and luggage", "Special requirements"];

export function TripBrief({ city }: { city?: string }) {
  return (
    <section id="brief" className="container-jn scroll-mt-[var(--header-h)] pt-14 max-md:pt-10">
      <div className="grid items-start gap-10 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        <div>
          <p className="eyebrow !mb-0 !font-normal !tracking-[0.14em]">Prepare a trip brief</p>
          <h2 className="mt-[10px] font-serif text-[34px] leading-[1.1]">Give the details that matter.</h2>
          <p className="mt-3 max-w-[46ch] text-steel">
            Include every leg, your preferred local times and anything that can be flexible. Mention luggage, pets and access needs
            before the aircraft is selected{city ? ` — and the actual address on each end, so dispatch picks the right ${city} field` : ""}.
          </p>
        </div>
        <ol className="m-0 grid list-none border-t border-line p-0 [grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr))]">
          {BRIEF.map((b, i) => (
            <li key={b} className="flex items-baseline gap-[14px] border-b border-line py-[18px] pr-3">
              <span className="font-serif text-[22px] text-gold">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-[16px]">{b}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function NextStep() {
  return (
    <section className="container-jn pt-14 max-md:pt-10">
      <div className="grid bg-surface-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        <div className="relative min-h-[260px]">
          <Image src="/images/light/sunset-lounge-view.webp" alt="Private terminal lounge at sunset" fill sizes="(max-width: 768px) 100vw, 600px" className="object-cover" />
        </div>
        <div className="flex flex-col justify-center gap-[14px] p-[clamp(24px,4vw,44px)]">
          <p className="eyebrow !mb-0 !font-normal !tracking-[0.14em]">Your next step</p>
          <p className="font-serif text-[26px] leading-[1.2]">
            Review the proposed aircraft, operating carrier, itinerary and complete price. Ask what needs to happen before the booking is
            confirmed.
          </p>
          <Link href="/how-it-works#confirm" className="self-start whitespace-nowrap border-b border-gold pb-[2px] font-bold hover:text-gold">
            See confirmation details →
          </Link>
        </div>
      </div>
    </section>
  );
}

const READS = [
  { k: "Start here", t: "How private jet charter works", b: "New to private jet charter? Five steps from your trip brief to a confirmed flight — what to provide, compare and expect.", href: "/how-it-works" },
  { k: "Plan", t: "Private jet charter cost", b: "Understand total trip pricing, aircraft choices, taxes and fees, with examples to help plan your flight.", href: "/guides/private-jet-charter-cost" },
  { k: "Book", t: "Charter safety", b: "Who operates your flight, what to verify before booking, and the standard every JetNine operator meets.", href: "/safety" },
];

export function NextReads() {
  return (
    <section className="container-jn pb-16 pt-14 max-md:pt-10">
      <h2 className="mb-5 font-serif text-[30px]">Useful next reads</h2>
      <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        {READS.map((r) => (
          <Link key={r.href} href={r.href} className="flex flex-col gap-[10px] border border-line-faint bg-white p-[22px] transition-colors hover:border-gold">
            <span className="text-[12px] uppercase tracking-[0.14em] text-gold">{r.k}</span>
            <span className="font-serif text-[22px]">{r.t}</span>
            <span className="text-steel">{r.b}</span>
            <span className="mt-auto font-bold">Read guide →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
