import Image from "next/image";
import Link from "next/link";
import { FLEET } from "@/lib/fleet";

// Plain-words formatting for the cards. fleet.ts's formatPax / formatNm
// print "9 PAX" / "1,200 NM" (jargon the simplification retires), so the
// homepage spells the same numbers as "Up to 9 passengers" / "Range 1,200 nm".
const fmt = new Intl.NumberFormat("en-US");

/**
 * Six category cards (4/5 photo, name, seats, range, "View specs →") with
 * "All aircraft →" top right. Six columns on desktop, three on tablets, a
 * horizontal strip with the scrollbar hidden on phones.
 */
export function AircraftGrid() {
  return (
    <section id="aircraft" className="container-jn section-jn-lg max-md:pt-16">
      <p className="eyebrow">Aircraft</p>
      <div className="flex items-end justify-between gap-6 max-md:flex-col max-md:items-start max-md:gap-3">
        <div>
          <h2 className="title-section">Your jet, your choice.</h2>
          <p className="mt-4 max-w-[56ch] text-[18px] text-bone-2 max-md:text-[16px]">
            Six categories. Hundreds of aircraft. The right one for the mission, every time.
          </p>
        </div>
        <Link href="/aircraft" className="text-link whitespace-nowrap text-[15px]">
          All aircraft →
        </Link>
      </div>

      <div className="mt-12 grid grid-cols-3 gap-3 lg:grid-cols-6 max-md:-mx-[var(--pad-x)] max-md:mt-6 max-md:flex max-md:overflow-x-auto max-md:px-[var(--pad-x)] max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden">
        {FLEET.map((a) => (
          <Link
            key={a.slug}
            href={a.href}
            className="card overflow-hidden max-md:w-[160px] max-md:flex-none"
          >
            <div className="relative aspect-[4/5] bg-surface-2">
              {a.imageUrl ? (
                <Image
                  src={a.imageUrl}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 160px, (max-width: 1024px) 33vw, 17vw"
                  className="object-cover"
                />
              ) : null}
            </div>
            <div className="p-4 max-md:p-3">
              <div className="text-[17px] font-medium leading-[1.3]">{a.name}</div>
              <div className="mt-1 text-[14px] text-bone-2">Up to {a.pax} passengers</div>
              <div className="text-[14px] text-steel">Range {fmt.format(a.rangeNm)} nm</div>
              <span className="mt-3 inline-block text-[14px] font-medium">View specs →</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
