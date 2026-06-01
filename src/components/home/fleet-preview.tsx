import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { Placeholder } from "@/components/placeholder";
import { FLEET, formatNm, formatPax } from "@/lib/fleet";

export function FleetPreview() {
  return (
    <section className="pb-40 sm:pb-24 lg:pb-40">
      <div className="container-jn">
        <div className="mb-20 grid items-end gap-16 lg:grid-cols-[1fr_1.6fr]">
          <Reveal>
            <p className="caption">— Aircraft</p>
          </Reveal>
          <div>
            <Reveal as="h2" stagger={1} className="display-m max-w-[18ch]">
              Your jet,
              <br />
              your choice.
            </Reveal>
            <Reveal stagger={2} as="p" className="mt-6 max-w-[58ch] text-[18px] leading-[1.55] text-bone-2">
              Six categories. Hundreds of airframes. The right one for the mission, every time.
            </Reveal>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {FLEET.map((a, i) => (
            <Reveal
              key={a.slug}
              stagger={(i % 3) as 0 | 1 | 2}
              className="group"
            >
              <Link
                href={a.href}
                className="block overflow-hidden rounded-[4px] border border-ink-3 bg-ink-2 transition-all duration-200 ease-out-quint hover:-translate-y-0.5 hover:border-clearance"
              >
                <div className="relative">
                  <Placeholder
                    caption={a.cap.replace(/^— /, "")}
                    aspect="4/5"
                    imageUrl={a.imageUrl}
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 17vw"
                  />
                  <div className="pointer-events-none absolute inset-0 flex items-end bg-gradient-to-t from-ink/85 via-transparent to-transparent p-4 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-clearance">
                      View specs →
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 p-4">
                  <span className="font-serif text-[17px] font-normal leading-[1.2] tracking-tight text-bone">
                    {a.name}
                  </span>
                  <span className="font-mono text-[10px] tracking-[0.04em] text-bone-2">
                    {formatPax(a.pax)} <span className="text-steel">·</span> {formatNm(a.rangeNm)}
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
