import Image from "next/image";
import Link from "next/link";

const GUIDES = [
  { href: "/guides/private-jet-charter-cost", title: "What does private charter cost?", img: "/images/light/wing-clouds.webp" },
  { href: "/safety/operator-vetting", title: "How to evaluate charter safety", img: "/images/light/cockpit.webp" },
  { href: "/guides", title: "Your first private flight", img: "/images/light/cabin-window.webp" },
];

/** "Fly informed." — three guide cards under a ruled heading row. */
export function GuidesPreview() {
  return (
    <section id="guides" className="container-jn mt-12">
      <div className="flex flex-wrap items-end justify-between gap-6 border-t border-line pt-10">
        <div>
          <p className="eyebrow">The charter guide</p>
          <h2 className="title-section !text-[clamp(34px,9vw,46px)]">Fly informed.</h2>
        </div>
        <Link href="/guides" className="rule-link !text-[16px]">
          Explore all guides <span className="arrow-sm" aria-hidden="true">↗</span>
        </Link>
      </div>
      <div className="mt-[22px] grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
        {GUIDES.map((g) => (
          <Link key={g.title} href={g.href} className="group block">
            <div className="relative aspect-[2/1] overflow-hidden bg-surface-2">
              <Image src={g.img} alt="" fill sizes="(max-width: 768px) 100vw, 400px" className="object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
            </div>
            <p className="eyebrow !mb-0 mt-3">Charter essentials</p>
            <h3 className="title-card-sm mt-[6px]">{g.title}</h3>
            <span className="rule-link mt-[10px] group-hover:text-gold">
              Read guide <span className="arrow-sm" aria-hidden="true">↗</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
