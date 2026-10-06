import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { FaqList, type FaqItem } from "@/components/company/faq-list";

/*
 * Static bands shared by Light - Concierge and Light - Birthday party.
 * Interactive triggers (open the planner, checklist…) are passed in as
 * nodes so these stay server components.
 */

export const sectionCls = "container-jn scroll-mt-[calc(var(--header-h)+16px)] pt-11";
export const h2Cls = "m-0 font-serif text-[32px] font-normal leading-[1.1]";
export const cardLinkCls = "mt-auto self-start pt-[6px] text-[13px] font-bold text-bone underline underline-offset-[3px] hover:text-gold";

export function Icon({ d, size = 24, className = "" }: { d: string; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--gold)"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`flex-none ${className}`}
    >
      <path d={d} />
    </svg>
  );
}

export const PATHS = {
  plane: "M21 3L3 10.5l7.5 3L13.5 21 21 3zM10.5 13.5L21 3",
  dining: "M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 0-3 2-3 5s1 4 3 4v9",
  car: "M3 16v-4l2.5-5h13l2.5 5v4zM3 12h18M3 16v2h3v-2M18 16v2h3v-2M7 14h1M16 14h1",
  hotel: "M5 21V4h9v17M14 9h5v12M3 21h18M8 8h3M8 12h3M8 16h3M16 13h1M16 17h1",
  headset: "M4 15v-3a8 8 0 0 1 16 0v3M4 15a2 2 0 0 0 2 2h1v-6H6a2 2 0 0 0-2 2zM20 15a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2zM17 17c0 2-2 3-5 3",
  doc: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  people: "M9 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20a7 7 0 0 1 14 0M16 5a3 3 0 0 1 0 6M19 20a6 6 0 0 0-3-5",
  clipboard: "M9 4h6v3H9zM7 5H5v16h14V5h-2M9 14l2 2 4-4",
  route: "M6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 16c0-6 12-4 12-8",
  cake: "M4 21h16M5 21v-7h14v7M5 17c2.3 1.4 4.7 1.4 7 0s4.7-1.4 7 0M12 14V9M12 6.5c-.8-.8-.8-1.8 0-3 .8 1.2.8 2.2 0 3z",
  alert: "M12 3l10 18H2zM12 10v5M12 18h.01",
};

export function BrokerNote({ children }: { children: ReactNode }) {
  return (
    <div className="container-jn mt-[14px]">
      <div className="flex flex-wrap items-center gap-[14px] border border-[#E8DFCF] bg-[#F6F0E6] px-[18px] py-[10px] text-[14px]">
        <span
          aria-hidden="true"
          className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border-[1.5px] border-gold font-serif text-[12px] font-bold text-gold"
        >
          i
        </span>
        <span className="flex-[1_1_240px]">{children}</span>
        <Link href="/legal" className="whitespace-nowrap underline underline-offset-[3px] hover:text-gold">
          Broker disclosure →
        </Link>
      </div>
    </div>
  );
}

export function PageRail({ items }: { items: [string, string][] }) {
  return (
    <div className="flex-[0_0_150px] self-stretch max-lg:hidden">
      <nav aria-label="On this page" className="sticky top-[calc(var(--header-h)+16px)] flex flex-col gap-[2px] text-[13px]">
        <span className="mb-[6px] text-steel">On this page</span>
        {items.map(([label, href], i) => (
          <a
            key={href}
            href={href}
            className={`px-3 py-[5px] ${i === 0 ? "text-bone shadow-[inset_2px_0_0_var(--gold)]" : "text-steel hover:text-bone"}`}
          >
            {label}
          </a>
        ))}
      </nav>
    </div>
  );
}

export type ServiceCard = { title: string; body: string; icon: string; action: ReactNode };

export function ServiceGrid({ cards }: { cards: ServiceCard[] }) {
  return (
    <div className="mt-[18px] grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
      {cards.map((c, i) => (
        <article
          key={c.title}
          className={`flex flex-col gap-[6px] border border-line bg-surface px-5 py-[18px] ${i === cards.length - 1 && cards.length % 2 ? "col-span-full" : ""}`}
        >
          <div className="flex items-start justify-between">
            <span className="font-serif text-[30px] leading-none text-gold">{String(i + 1).padStart(2, "0")}</span>
            <Icon d={c.icon} />
          </div>
          <h3 className="m-0 mt-1 font-serif text-[21px] font-normal">{c.title}</h3>
          <p className="m-0 max-w-[70ch] text-[14px] text-steel">{c.body}</p>
          {c.action}
        </article>
      ))}
    </div>
  );
}

export function PhotoBand({
  src,
  alt,
  aspect,
  position = "center",
  className = "",
  sizes = "(max-width: 1024px) 100vw, 760px",
}: {
  src: string;
  alt: string;
  aspect: string;
  position?: string;
  className?: string;
  sizes?: string;
}) {
  return (
    <div className={`relative overflow-hidden bg-[#ECE8DF] ${className}`} style={{ aspectRatio: aspect }}>
      <Image
        src={src}
        alt={alt}
        aria-hidden={alt === "" ? true : undefined}
        fill
        sizes={sizes}
        className="object-cover"
        style={{ objectPosition: position }}
      />
    </div>
  );
}

export function ConfirmTable({ label, head, rows }: { label: string; head: [string, string, string]; rows: [string, string, string][] }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className="mt-4 overflow-x-auto border border-line bg-surface">
      <table className="w-full min-w-[620px] border-collapse text-[14px]">
        <thead>
          <tr className="bg-[#F1EDE5] text-left">
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-[10px] text-[13px]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([a, b, c]) => (
            <tr key={a} className="border-t border-line">
              <th scope="row" className="px-4 py-[10px] text-left text-[13px]">
                {a}
              </th>
              <td className="px-4 py-[10px] text-[#2F4654]">{b}</td>
              <td className="px-4 py-[10px] text-steel">{c}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SandNote({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mt-3 flex flex-wrap items-center gap-x-[18px] gap-y-2 border border-[#E8DFCF] bg-[#F6F0E6] px-[18px] py-[10px] text-[14px] ${className}`}>
      {children}
    </div>
  );
}

export function ExternalLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`underline underline-offset-[3px] hover:text-gold ${className}`}>
      {children} <span aria-hidden="true">↗</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export type SourceItem = { org: string; title: string; body: string; link: string; href: string };

export function SourcesSection({
  title,
  sub,
  items,
  note,
}: {
  title: string;
  sub?: string;
  items: SourceItem[];
  note: string;
}) {
  return (
    <section id="sources" className={sectionCls}>
      <p className="eyebrow !mb-1 !tracking-[0.18em]">Independent guidance</p>
      <h2 className={h2Cls}>{title}</h2>
      {sub ? <p className="mt-[6px] text-[15px] text-steel">{sub}</p> : null}
      <div className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
        {items.map((s) => (
          <article key={s.org} className="flex flex-col gap-1 border border-t-2 border-line border-t-gold bg-surface px-5 py-4">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-gold">{s.org}</span>
            <h3 className="m-0 font-serif text-[20px] font-normal">{s.title}</h3>
            <p className="m-0 text-[14px] text-steel">{s.body}</p>
            <ExternalLink href={s.href} className="mt-[6px] self-start text-[13px]">
              {s.link}
            </ExternalLink>
          </article>
        ))}
      </div>
      <p className="mt-[10px] text-[12px] text-steel">{note}</p>
    </section>
  );
}

export function QuestionsSection({ items }: { items: FaqItem[] }) {
  return (
    <section id="questions" className={`${sectionCls} flex flex-wrap gap-x-10 gap-y-5`}>
      <div className="flex-[1_1_200px]">
        <h2 className={h2Cls}>A few useful answers.</h2>
      </div>
      <div className="min-w-0 flex-[999_1_420px]">
        <FaqList items={items} />
      </div>
    </section>
  );
}

export type RelatedGuide = { title: string; href: string; img: string; link: string };

export function RelatedGuides({ items }: { items: RelatedGuide[] }) {
  return (
    <section className="container-jn flex flex-wrap gap-x-10 gap-y-5 pb-11 pt-11">
      <div className="flex-[1_1_200px]">
        <p className="eyebrow !mb-1 !tracking-[0.18em]">Related guides</p>
        <h2 className={h2Cls}>Plan the next detail.</h2>
      </div>
      <div className="grid min-w-0 flex-[999_1_420px] gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))]">
        {items.map((g) => (
          <Link key={g.href} href={g.href} className="group block border border-line bg-surface">
            <span className="relative block aspect-video overflow-hidden bg-[#ECE8DF]">
              <Image src={g.img} alt="" aria-hidden fill sizes="(max-width: 768px) 100vw, 300px" className="object-cover" />
            </span>
            <span className="block px-[14px] pb-[14px] pt-[10px]">
              <span className="block font-serif text-[19px] leading-[1.2]">{g.title}</span>
              <span className="mt-[6px] block text-[12px] underline underline-offset-[3px] group-hover:text-gold">{g.link} →</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Closing navy band with a planner button (and optional photo wash). */
export function NavyBand({ title, body, image, action }: { title: string; body: string; image?: string; action: ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-[#12232E] text-white">
      {image ? (
        <div aria-hidden="true" className="absolute inset-0 opacity-40">
          <Image src={image} alt="" fill sizes="100vw" className="object-cover" style={{ objectPosition: "center 55%" }} />
        </div>
      ) : null}
      <div className="container-jn relative flex flex-wrap items-center justify-between gap-x-6 gap-y-4 py-[34px]">
        <div>
          <h2 className="m-0 font-serif text-[30px] font-normal leading-[1.1] text-white">{title}</h2>
          <p className="mt-[6px] text-[15px] text-white">{body}</p>
        </div>
        {action}
      </div>
    </section>
  );
}

/** Plain text block of FAQ data, reused for the FAQPage JSON-LD. */
export function faqJsonLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

export function breadcrumbJsonLd(crumbs: { name: string; path: string }[]) {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: `${siteUrl}${c.path}` })),
  };
}
