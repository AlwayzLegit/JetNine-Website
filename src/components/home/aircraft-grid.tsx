import Image from "next/image";
import Link from "next/link";

const CATEGORIES = [
  { href: "/aircraft/light", title: "Light jets", body: "Agile travel for shorter journeys", img: "/images/light/jet-light.webp" },
  { href: "/aircraft/midsize", title: "Midsize jets", body: "More space. More possibilities.", img: "/images/light/cabin-supermid.webp" },
  { href: "/aircraft/ultra", title: "Long-range jets", body: "For journeys that take you further", img: "/images/light/jet-ultra-flight.webp" },
];

/** "The right fit" — three aircraft categories as 16:9 photo cards. */
export function AircraftGrid() {
  return (
    <section id="aircraft" className="container-jn pt-14">
      <p className="eyebrow">The right fit</p>
      <h2 className="title-section !text-[clamp(34px,9vw,56px)] !leading-[1.06]">An aircraft for every kind of journey.</h2>
      <p className="mt-3 font-serif text-[16px] text-steel">
        Explore aircraft categories. We’ll help match your route, party and priorities.
      </p>
      <div className="mt-[26px] grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
        {CATEGORIES.map((c) => (
          <Link key={c.href} href={c.href} className="group block">
            <div className="relative aspect-video overflow-hidden bg-surface-2">
              <Image src={c.img} alt="" fill sizes="(max-width: 768px) 100vw, 400px" className="object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
            </div>
            <h3 className="title-card mt-[14px]">{c.title}</h3>
            <p className="mt-1 font-serif text-[15px] text-steel">{c.body}</p>
            <span className="rule-link mt-3 group-hover:text-gold">
              Explore category <span className="arrow-sm" aria-hidden="true">↗</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
