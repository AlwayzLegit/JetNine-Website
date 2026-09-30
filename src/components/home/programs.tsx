import Image from "next/image";
import Link from "next/link";

type Program = {
  href: string;
  title: string;
  body: string;
  imageUrl: string;
};

const PROGRAMS: Program[] = [
  {
    href: "/how-it-works",
    title: "On-demand charter",
    body: "Pay-as-you-fly. No commitment. Quotes within minutes, all-in pricing, your aircraft of choice.",
    imageUrl: "/images/programs/tarmac-dusk.webp",
  },
  {
    href: "/memberships",
    title: "JetNine Card",
    body: "Fixed hourly rates. Guaranteed availability. The membership program for the regular flyer.",
    imageUrl: "/images/programs/black-card.webp",
  },
  {
    href: "/empty-legs",
    title: "Empty legs",
    body: "Repositioning flights at deep discount. Real-time availability for travelers with flexibility.",
    imageUrl: "/images/programs/reposition-sector.webp",
  },
];

export function Programs() {
  return (
    <section id="programs" className="container-jn section-jn-lg max-md:pt-16">
      <p className="eyebrow">Our programs</p>
      <h2 className="title-section max-w-[20ch]">Three ways to fly with JetNine.</h2>

      <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3 max-md:mt-6">
        {PROGRAMS.map((p) => (
          <Link key={p.href} href={p.href} className="card overflow-hidden">
            <div className="relative aspect-[16/10] bg-surface-2">
              <Image
                src={p.imageUrl}
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover"
              />
            </div>
            <div className="px-7 pb-7 pt-6 max-md:px-5 max-md:pb-5 max-md:pt-4">
              <h3 className="title-card">{p.title}</h3>
              <p className="mt-[10px] text-bone-2">{p.body}</p>
              <span className="mt-[18px] inline-block text-[15px] font-medium">Explore →</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
