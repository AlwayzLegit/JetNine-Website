import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { SITE } from "@/lib/constants";

/**
 * Building blocks of the light long-form guide template (Light - Guide
 * page / the seven "Light - Guide - …" boards). Each guide page composes
 * these with its own copy, so the grammar stays identical across guides.
 *
 * The boards use three warm tints that have no token of their own (the
 * notice bar, its border, and the round icon well); they live here, once.
 */
export const TINT_BG = "bg-[#F6F0E6]";
export const TINT_BORDER = "border-[#E8DFCF]";
export const WELL_BG = "bg-panel-well";

/** Stroke icons from the boards (24×24, bronze 1.4px). */
export const ICONS = {
  plane: "M21 15.5v-1.8l-8-5V3.5a1.5 1.5 0 0 0-3 0v5.2l-8 5v1.8l8-2.5v5.5l-2 1.5V21l3.5-1 3.5 1v-1.5l-2-1.5V13z",
  send: "M21 3L3 10.5l7.5 3L13.5 21 21 3zM10.5 13.5L21 3",
  doc: "M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 15h7M9 18h4",
  page: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  coins: "M5 7c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3zM5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5",
  cal: "M3 6h18v15H3zM3 10h18M8 3v4M16 3v4M7 14h2M11 14h2M15 14h2M7 17h2M11 17h2",
  calSimple: "M3 6h18v15H3zM3 10h18M8 3v4M16 3v4",
  person: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  people: "M9 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20a7 7 0 0 1 14 0M16 5a3 3 0 0 1 0 6M19 20a6 6 0 0 0-3-5",
  broker: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M16 4a3 3 0 0 1 0 6M18 20a6 6 0 0 0-2.5-4.9",
  seat: "M7 4h6a2 2 0 0 1 2 2v7H7zM5 13h12v3H5zM8 16v4M14 16v4",
  bag: "M5 8h14v12H5zM9 8V5h6v3M9 12v4M15 12v4",
  sofa: "M4 10h16v6H4zM6 10V7h12v3M5 16v2M19 16v2",
  wifi: "M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01",
  pin: "M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11zM14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0z",
  cater: "M4 17h16M6 17a6 6 0 0 1 12 0M12 8V6M10 6h4M3 20h18",
  weather: "M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 11a3.5 3.5 0 0 0 1 7zM16 3v2M20 6l-1.5 1.5M22 10h-2",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1",
  route: "M6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 16c0-6 12-4 12-8",
  tower: "M9 21h6M12 21v-8M8 13h8l-2-6H10zM10 7V3h4v4M6 21l2-8M18 21l-2-8",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3.5 2",
  fuel: "M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M5 21h10M7 7h6v4H7zM15 10h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V9l-3-3",
  check: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12l3 3 5-6",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01",
  shield: "M12 3l8 4v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V7l8-4z",
  flex: "M17 11s-3-2.8-3-5.5a3 3 0 0 1 6 0C20 8.2 17 11 17 11zM5 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM7 18c4 0 3-5 7-5",
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 22, className = "" }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--gold)"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={`flex-none ${className}`}
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

/** Round sand well holding an icon (44–52px on the boards). */
export function IconWell({ name, size = 52 }: { name: IconName; size?: number }) {
  return (
    <span
      className={`flex flex-none items-center justify-center rounded-full ${WELL_BG}`}
      style={{ width: size, height: size }}
    >
      <Icon name={name} size={Math.round(size * 0.46)} />
    </span>
  );
}

/** Small numbered disc (01, 02 …). */
export function NumDisc({ n, size = 30 }: { n: string; size?: number }) {
  return (
    <span
      className={`flex flex-none items-center justify-center rounded-full text-[12px] font-bold text-gold ${WELL_BG}`}
      style={{ width: size, height: size }}
    >
      {n}
    </span>
  );
}

/** 12px bold uppercase bronze overline used above section titles. */
export function Overline({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`mb-1 text-[12px] font-bold uppercase tracking-[.18em] text-gold ${className}`}>{children}</p>
  );
}

/** Serif section title (32px default; the boards use 28–36px). */
export function H2({ children, size = 32, className = "" }: { children: ReactNode; size?: number; className?: string }) {
  return (
    <h2
      className={`m-0 font-serif font-normal leading-[1.1] ${className}`}
      style={{ fontSize: `clamp(26px, 6vw, ${size}px)` }}
    >
      {children}
    </h2>
  );
}

export function Sub({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`mt-1 text-[15px] text-steel ${className}`}>{children}</p>;
}

/** Underlined inline link; external links open in a new tab with ↗. */
export function UnderLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const cls = `text-[13px] text-bone underline underline-offset-[3px] hover:text-gold ${className}`;
  if (/^https?:/.test(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {children} <span aria-hidden="true">↗</span>
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children} <span aria-hidden="true">→</span>
    </Link>
  );
}

/**
 * The broker disclosure bar under every guide hero. The sentence is the
 * site's legal Part 295 line, verbatim, linking to the broker section of
 * /legal.
 */
export function BrokerNote({ linkLabel = "Read broker disclosure", className = "mt-[14px]" }: { linkLabel?: string; className?: string }) {
  return (
    <div className={`container-jn ${className}`}>
      <div className={`flex flex-wrap items-center gap-x-[14px] gap-y-2 border px-[18px] py-[10px] text-[14px] ${TINT_BG} ${TINT_BORDER}`}>
        <span
          aria-hidden="true"
          className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border-[1.5px] border-gold font-serif text-[12px] font-bold text-gold"
        >
          i
        </span>
        <span className="min-w-0 flex-1 basis-[220px]">{SITE.legal.part295}</span>
        <Link href="/legal#part-295" className="whitespace-nowrap text-bone underline underline-offset-[3px] hover:text-gold">
          {linkLabel} →
        </Link>
      </div>
    </div>
  );
}

/** Inline notice row: bronze "i" (info) or red "!" (caution). */
export function Notice({
  tone = "info",
  children,
  action,
  className = "mt-2",
}: {
  tone?: "info" | "warn";
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 border px-4 py-[9px] text-[13px] ${TINT_BG} ${TINT_BORDER} ${className}`}>
      <span
        aria-hidden="true"
        className={[
          "flex h-5 w-5 flex-none items-center justify-center rounded-full border-[1.5px] text-[12px] font-bold",
          tone === "warn" ? "border-danger text-danger" : "border-gold font-serif text-gold",
        ].join(" ")}
      >
        {tone === "warn" ? "!" : "i"}
      </span>
      <span className="min-w-0 flex-1 basis-[200px]">{children}</span>
      {action}
    </div>
  );
}

/** Bordered white table whose columns wrap to a stack on phones. */
export function FlowTable({
  headers,
  rows,
  min = 180,
}: {
  headers: string[];
  rows: ReactNode[][];
  min?: number;
}) {
  const cols = { gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}px), 1fr))` };
  return (
    <div className="border border-line bg-white" role="table">
      <div role="row" className="grid bg-surface-2 px-4 py-2 text-[13px] font-bold max-sm:hidden" style={cols}>
        {headers.map((h) => (
          <span role="columnheader" key={h}>
            {h}
          </span>
        ))}
      </div>
      {rows.map((r, i) => (
        <div role="row" key={i} className="grid gap-x-4 gap-y-[2px] border-t border-surface-2 px-4 py-[7px] text-[13px] text-bone-2" style={cols}>
          {r.map((c, j) => (
            <span role="cell" key={j} className={j === 0 ? "text-bone max-sm:font-bold" : ""}>
              {c}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Numbered check table: "01 · Who operates the flight?" | what to request. */
export function CheckTable({
  headers,
  rows,
  compact = false,
}: {
  headers: [string, string];
  rows: [string, string][];
  compact?: boolean;
}) {
  const cols = { gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))" };
  return (
    <div className="border border-line bg-white" role="table">
      <div role="row" className="grid gap-x-4 bg-surface-2 px-4 py-2 text-[12px] font-bold uppercase tracking-[.14em] text-steel" style={cols}>
        <span role="columnheader">{headers[0]}</span>
        <span role="columnheader" className="max-[340px]:hidden">
          {headers[1]}
        </span>
      </div>
      {rows.map(([t, r], i) => (
        <div role="row" key={t} className="grid items-center gap-x-4 border-t border-surface-2" style={cols}>
          <div role="cell" className={`flex h-full items-center gap-[14px] border-r border-surface-2 px-4 ${compact ? "py-2" : "py-[10px]"}`}>
            <NumDisc n={`0${i + 1}`} size={compact ? 28 : 30} />
            <span className={`font-serif ${compact ? "text-[16px]" : "text-[17px]"}`}>{t}</span>
          </div>
          <span role="cell" className={`px-4 text-bone-2 ${compact ? "py-2 text-[13px]" : "py-[10px] text-[14px]"}`}>
            {r}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Numbered list rows inside one bordered box (disc + serif title | note). */
export function StepRows({ rows }: { rows: [string, string][] }) {
  return (
    <div className="border border-line bg-white">
      {rows.map(([t, b], i) => (
        <div
          key={t}
          className={`grid items-center gap-x-[14px] gap-y-1 px-4 py-[9px] ${i ? "border-t border-surface-2" : ""}`}
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))" }}
        >
          <div className="flex items-center gap-[14px]">
            <NumDisc n={`0${i + 1}`} size={28} />
            <span className="font-serif text-[16px]">{t}</span>
          </div>
          <span className="text-[13px] text-steel">{b}</span>
        </div>
      ))}
    </div>
  );
}

/** "01 Title / note" columns separated by thin rules (Get it in writing). */
export function NumberCols({
  items,
  variant = "ring",
}: {
  items: { t: string; b: string }[];
  /** ring: 40px bronze ring; big: 32px serif numeral. */
  variant?: "ring" | "big";
}) {
  return (
    <div className="grid gap-y-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))" }}>
      {items.map((w, i) => (
        <div
          key={w.t}
          className={[
            "grid min-w-0",
            variant === "ring" ? "grid-cols-[44px_minmax(0,1fr)] gap-4 px-5 py-1" : "grid-cols-[auto_minmax(0,1fr)] gap-[10px] px-3 py-[2px]",
            i ? "border-l border-line max-sm:border-l-0" : "",
          ].join(" ")}
        >
          {variant === "ring" ? (
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-gold font-serif text-[16px] text-gold">
              0{i + 1}
            </span>
          ) : (
            <span className="font-serif text-[32px] leading-none text-gold">0{i + 1}</span>
          )}
          <div className="min-w-0">
            <div className={`font-serif leading-[1.2] ${variant === "ring" ? "text-[19px]" : "text-[17px]"}`}>{w.t}</div>
            <p className={`m-0 text-steel ${variant === "ring" ? "mt-1 text-[13px]" : "text-[12px]"}`}>{w.b}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/** White card with an icon well, serif title and a note. */
export function IconCard({
  icon,
  title,
  children,
  well = 52,
  className = "",
}: {
  icon: IconName;
  title: ReactNode;
  children?: ReactNode;
  well?: number;
  className?: string;
}) {
  return (
    <div className={`grid gap-4 border border-line bg-white p-[18px] ${className}`} style={{ gridTemplateColumns: `${well}px minmax(0,1fr)` }}>
      <IconWell name={icon} size={well} />
      <div className="min-w-0">
        <div className="font-serif text-[20px] leading-[1.2]">{title}</div>
        {children ? <div className="mt-1 text-[13px] leading-[1.5] text-steel">{children}</div> : null}
      </div>
    </div>
  );
}

/** Responsive auto-fit grid. */
export function AutoGrid({ min = 260, gap = "gap-[10px]", className = "", children }: { min?: number; gap?: string; className?: string; children: ReactNode }) {
  return (
    <div className={`grid ${gap} ${className}`} style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}px), 1fr))` }}>
      {children}
    </div>
  );
}

/** Tinted "Pause and ask more if…" panel with red ! rows. */
export function WarnPanel({
  id,
  title,
  sub,
  items,
  link,
}: {
  id?: string;
  title: string;
  sub?: string;
  items: string[];
  link?: { label: string; href: string };
}) {
  return (
    <div id={id} className={`px-5 py-[18px] ${TINT_BG}`}>
      <H2 size={30}>{title}</H2>
      {sub ? <p className="mt-1 text-[14px] text-steel">{sub}</p> : null}
      <div className="mt-2">
        {items.map((w) => (
          <div key={w} className={`flex items-center gap-4 border-b py-[10px] text-[14px] ${TINT_BORDER}`}>
            <span
              aria-hidden="true"
              className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full border-[1.5px] border-danger text-[14px] font-bold text-danger"
            >
              !
            </span>
            <span>{w}</span>
          </div>
        ))}
      </div>
      {link ? <UnderLink href={link.href} className="mt-[10px] inline-block">{link.label}</UnderLink> : null}
    </div>
  );
}

export type SourceCard = { org: string; title: string; body: string; link: string; url: string };

/** "Go to the original sources." cards with a bronze top rule. */
export function SourceCards({ sources, note }: { sources: SourceCard[]; note: string }) {
  return (
    <>
      <AutoGrid min={180} gap="gap-3" className="mt-[14px]">
        {sources.map((s) => (
          <div key={s.url + s.title} className="border border-t-2 border-line border-t-gold-light bg-white px-[18px] py-[14px]">
            <div className="text-[12px] font-bold uppercase tracking-[.14em] text-gold">{s.org}</div>
            <div className="mt-2 font-serif text-[19px] leading-[1.2]">{s.title}</div>
            <p className="mb-2 mt-1 text-[13px] text-steel">{s.body}</p>
            <UnderLink href={s.url}>{s.link}</UnderLink>
          </div>
        ))}
      </AutoGrid>
      <p className="mt-2 text-center text-[12px] text-steel">{note}</p>
    </>
  );
}

export type SourceRow = { org: string; label: string; url: string };

/** Compact source rows: organisation | link. */
export function SourceRows({ sources, note, stacked = false }: { sources: SourceRow[]; note: string; stacked?: boolean }) {
  return (
    <>
      <div className="mt-[10px] flex flex-col gap-[6px]">
        {sources.map((s) => (
          <div
            key={s.url + s.label}
            className={`flex border border-line bg-white px-[14px] py-2 ${stacked ? "flex-col gap-[2px]" : "flex-wrap items-center gap-3"}`}
          >
            <span className={`font-serif text-[16px] ${stacked ? "" : "min-w-0 max-w-full flex-[1_1_150px]"}`}>{s.org}</span>
            <span className={stacked ? "" : "min-w-0 flex-[999_1_200px]"}>
              <UnderLink href={s.url}>{s.label}</UnderLink>
            </span>
          </div>
        ))}
      </div>
      <p className="mt-[6px] text-[12px] text-steel">{note}</p>
    </>
  );
}

export type RelatedCard = { title: string; body: string; link: string; href: string; image: string };

/** "Explore related guides." image cards. */
export function RelatedCards({ items }: { items: RelatedCard[] }) {
  return (
    <AutoGrid min={160} gap="gap-3" className="mt-[14px]">
      {items.map((r) => (
        <Link key={r.href + r.title} href={r.href} className="group block border border-line bg-white text-bone hover:text-bone">
          <span className="relative block aspect-[16/7] overflow-hidden bg-surface-2">
            <Image src={r.image} alt="" fill sizes="(max-width: 768px) 100vw, 300px" className="object-cover" />
          </span>
          <span className="block px-3 pb-3 pt-2">
            <span className="block font-serif text-[16px]">{r.title}</span>
            <span className="block text-[12px] text-steel">{r.body}</span>
            <span className="mt-[6px] block text-[12px] underline underline-offset-[3px] group-hover:text-gold">{r.link} →</span>
          </span>
        </Link>
      ))}
    </AutoGrid>
  );
}

/** Sand "Continue planning" link strip. */
export function ContinueStrip({ label = "Continue planning", links }: { label?: string; links: { label: string; href: string }[] }) {
  return (
    <section className="container-jn mt-[26px]">
      <div className="flex flex-wrap items-center gap-x-7 gap-y-2 bg-surface-2 px-[18px] py-[10px] text-[13px]">
        <span className="font-serif text-[17px]">{label}</span>
        {links.map((l) => (
          <Link key={l.href + l.label} href={l.href} className="whitespace-nowrap text-bone underline hover:text-gold">
            {l.label} →
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Sand closing prompt: icon, title + line, one action on the right. */
export function TripPrompt({
  icon = "calSimple",
  title,
  body,
  action,
}: {
  icon?: IconName;
  title: string;
  body: string;
  action: ReactNode;
}) {
  return (
    <section className="container-jn mb-[26px] mt-3">
      <div className="flex flex-wrap items-center gap-4 bg-surface-2 px-5 py-4">
        <Icon name={icon} size={36} />
        <div className="min-w-0 flex-[999_1_240px]">
          <h2 className="m-0 font-serif text-[24px] font-normal leading-[1.1]">{title}</h2>
          <p className="mt-[2px] text-[14px] text-steel">{body}</p>
        </div>
        <div className="max-w-full flex-none">{action}</div>
      </div>
    </section>
  );
}

/** Compact navy closing band over a faded photo (Broker / Fees boards). */
export function GuideBand({
  title,
  body,
  image,
  action,
}: {
  title: string;
  body: string;
  image: string;
  action: ReactNode;
}) {
  return (
    <section className="on-navy relative overflow-hidden bg-navy">
      <Image src={image} alt="" aria-hidden fill sizes="100vw" className="object-cover opacity-45" style={{ objectPosition: "center 60%" }} />
      <div className="container-jn relative py-[30px]">
        <h2 className="m-0 font-serif text-[32px] font-normal leading-[1.1] text-white">{title}</h2>
        <p className="mb-4 mt-1 text-[16px] text-white">{body}</p>
        {action}
      </div>
    </section>
  );
}

/** Button-styled link classes used across the boards. */
export const BTN = {
  /** 42px filled navy. */
  navy: "inline-flex h-[42px] items-center gap-[10px] rounded-[2px] border border-clearance bg-clearance px-5 text-[14px] font-bold text-white hover:bg-clearance-hover hover:text-white",
  /** 42px filled bronze. */
  bronze: "inline-flex h-[42px] items-center gap-[10px] rounded-[2px] border border-gold bg-gold px-5 text-[14px] font-bold text-white hover:text-white hover:brightness-110",
  /** 42px outlined navy on white. */
  outline: "inline-flex h-[42px] items-center gap-[10px] rounded-[2px] border border-bone bg-white px-5 text-[14px] font-bold text-bone hover:text-gold",
  /** 42px outlined, translucent white (over a bleed image). */
  ghost: "inline-flex h-[42px] items-center gap-[10px] rounded-[2px] border border-bone bg-[rgba(255,255,255,0.7)] px-5 text-[14px] font-bold text-bone hover:text-gold",
  /** White button on navy. */
  onNavy: "inline-flex h-[42px] items-center gap-2 rounded-[2px] border border-white bg-white px-[22px] text-[14px] font-bold text-navy hover:bg-surface-2 hover:text-navy",
  /** Underlined text button. */
  text: "border-0 bg-transparent p-0 text-[13px] text-bone underline underline-offset-[3px] hover:text-gold",
};
