import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { Placeholder } from "@/components/placeholder";

type Program = {
  href: string;
  cap: string;
  title: string;
  body: string;
  imageUrl?: string;
};

const PROGRAMS: Program[] = [
  {
    href: "/how-it-works",
    cap: "— TARMAC, DUSK",
    title: "On-demand charter",
    body: "Pay-as-you-fly. No commitment. Quotes within minutes, all-in pricing, your airframe of choice.",
    imageUrl: "/images/programs/tarmac-dusk.webp",
  },
  {
    href: "/memberships",
    cap: "— BLACK CARD, STILL LIFE",
    title: "JetNine Card",
    body: "Fixed hourly rates. Guaranteed availability. The membership program for the regular flyer.",
    imageUrl: "/images/programs/black-card.webp",
  },
  {
    href: "/empty-legs",
    cap: "— REPOSITION SECTOR",
    title: "Empty legs",
    body: "Repositioning flights at deep discount. Real-time availability for travelers with flexibility.",
    imageUrl: "/images/programs/reposition-sector.webp",
  },
];

export function Programs() {
  return (
    <section className="py-40 sm:py-24 lg:py-40">
      <div className="container-jn">
        <div className="mb-20 grid items-end gap-16 lg:grid-cols-[1fr_1.6fr]">
          <Reveal>
            <p className="caption">— Our programs</p>
          </Reveal>
          <Reveal as="h2" stagger={1} className="display-m max-w-[22ch]">
            Three ways
            <br />
            to fly with JetNine.
          </Reveal>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PROGRAMS.map((p, i) => (
            <Reveal
              key={p.href}
              stagger={(i as 0 | 1 | 2)}
              className="group"
            >
              <Link
                href={p.href}
                className="block overflow-hidden rounded-[4px] border border-ink-3 bg-ink-2 transition-all duration-200 ease-out-quint hover:-translate-y-0.5 hover:border-clearance"
              >
                <Placeholder
                  caption={p.cap}
                  aspect="16/10"
                  imageUrl={p.imageUrl}
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
                <div className="flex flex-col gap-2 p-7">
                  <h3 className="font-serif text-[24px] font-normal leading-[1.2] tracking-tight text-bone">
                    {p.title}
                  </h3>
                  <p className="text-[15px] leading-[1.55] text-bone-2">{p.body}</p>
                  <span className="mt-4 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-bone transition-colors group-hover:text-clearance">
                    Explore <span className="arrow">→</span>
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
