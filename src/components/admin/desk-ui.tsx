import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Desk UI primitives (Phase 5). Server components — no state. Every admin
 * section composes these so the desk reads as one product:
 *
 *   <DeskPage>                       main column, 32px/40px padding
 *     <DeskHeader title lead actions />
 *     <DeskTabs items current base />
 *     <DeskGroup title count>        13px steel heading + card list
 *       <DeskRow … />
 *     </DeskGroup>
 *     <DeskEmpty title body />
 */

export function DeskPage({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`min-w-0 px-5 pb-16 pt-6 md:px-10 md:pt-8 ${className}`}>{children}</div>;
}

export function DeskHeader({
  title,
  lead,
  back,
  actions,
  className = "",
}: {
  title: ReactNode;
  lead?: ReactNode;
  /** "← All requests" style link above the title. */
  back?: { href: string; label: string };
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {back ? (
        <Link href={back.href} className="text-[14px] text-steel transition-colors hover:text-bone">
          ← {back.label}
        </Link>
      ) : null}
      <div className={`flex flex-wrap items-end justify-between gap-6 ${back ? "mt-2" : ""}`}>
        <div className="min-w-0">
          <h1 className="title-app text-bone">{title}</h1>
          {lead ? <p className="mt-1.5 text-[16px] text-bone-2">{lead}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
      </div>
    </div>
  );
}

/** GET search box; submits `name` (default `q`) to the current page. */
export function DeskSearch({
  placeholder = "Search a name or city",
  defaultValue = "",
  name = "q",
  action,
  hidden,
  width = 260,
}: {
  placeholder?: string;
  defaultValue?: string;
  name?: string;
  action?: string;
  /** Extra params to keep (tab, period…). */
  hidden?: Record<string, string | undefined>;
  width?: number | string;
}) {
  return (
    <form action={action} method="get" role="search" className="flex">
      {hidden
        ? Object.entries(hidden)
            .filter(([, v]) => v)
            .map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)
        : null}
      <label
        className="flex h-11 items-center gap-2 rounded-control border border-line bg-surface px-3.5 text-[15px] text-bone focus-within:border-steel"
        style={{ width }}
      >
        <span aria-hidden="true" className="text-steel">
          ⌕
        </span>
        <input
          type="search"
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          aria-label={placeholder}
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-steel"
        />
      </label>
    </form>
  );
}

export type DeskTab = { key: string; label: string; count?: number; href?: string };

/**
 * Underline tabs rendered as links (`?tab=key` on `base` unless `href` is
 * given), so the list filters server-side and the URL is shareable.
 */
export function DeskTabs({
  items,
  current,
  base,
  param = "tab",
  keep,
  className = "",
}: {
  items: DeskTab[];
  current: string;
  base: string;
  param?: string;
  /** Other params to keep when switching tabs (q, period…). */
  keep?: Record<string, string | undefined>;
  className?: string;
}) {
  const qs = (key: string) => {
    const p = new URLSearchParams();
    if (keep) for (const [k, v] of Object.entries(keep)) if (v) p.set(k, v);
    p.set(param, key);
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };
  return (
    <div role="tablist" className={`flex gap-1 overflow-x-auto border-b border-line ${className}`}>
      {items.map((t) => {
        const active = t.key === current;
        return (
          <Link
            key={t.key}
            role="tab"
            aria-selected={active}
            aria-current={active ? "page" : undefined}
            href={t.href ?? qs(t.key)}
            className={[
              "-mb-px whitespace-nowrap border-b-2 px-3.5 py-3 text-[15px] font-medium transition-colors",
              active ? "border-clearance text-bone" : "border-transparent text-steel hover:text-bone",
            ].join(" ")}
          >
            {t.label}
            {typeof t.count === "number" ? <span className={active ? "text-steel" : ""}> · {t.count}</span> : null}
          </Link>
        );
      })}
    </div>
  );
}

/** 13px steel group heading + card that clips its rows. */
export function DeskGroup({
  title,
  count,
  children,
  className = "mt-8",
  aside,
}: {
  title: ReactNode;
  count?: number;
  children: ReactNode;
  className?: string;
  aside?: ReactNode;
}) {
  return (
    <section className={className}>
      <div className="mb-2.5 flex items-center justify-between gap-4">
        <h2 className="label-jn text-[13px]">
          {title}
          {typeof count === "number" ? <span className="text-steel-dim"> · {count}</span> : null}
        </h2>
        {aside}
      </div>
      <div className="card overflow-hidden">{children}</div>
    </section>
  );
}

/**
 * One row inside a DeskGroup. Grid columns are the caller's (prototype uses
 * `minmax(0,1fr) 240px auto`); rows separate with a faint line.
 */
export function DeskRow({
  children,
  className = "",
  cols = "md:grid-cols-[minmax(0,1fr)_240px_auto]",
  href,
}: {
  children: ReactNode;
  className?: string;
  cols?: string;
  href?: string;
}) {
  const cls = `grid grid-cols-1 items-center gap-3 border-b border-line-faint px-5 py-4 last:border-b-0 md:gap-6 md:px-6 md:py-[18px] ${cols} ${className}`;
  if (href) {
    return (
      <Link href={href} className={`${cls} transition-colors hover:bg-surface-2/50`}>
        {children}
      </Link>
    );
  }
  return <div className={cls}>{children}</div>;
}

export function DeskEmpty({
  title = "All caught up.",
  body,
  className = "mt-8",
  children,
}: {
  title?: ReactNode;
  body?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`rounded-card border border-dashed border-line-2 bg-surface p-10 text-center ${className}`}>
      <p className="text-[19px] text-bone">{title}</p>
      {body ? <p className="mt-1.5 text-bone-2">{body}</p> : null}
      {children ? <div className="mt-5 flex justify-center gap-2.5">{children}</div> : null}
    </div>
  );
}

/** ● sentence, coloured dot. */
export function DotSentence({
  tone,
  children,
  className = "",
}: {
  tone: "gold" | "steel" | "success" | "danger";
  children: ReactNode;
  className?: string;
}) {
  const dot = tone === "steel" ? "dot" : `dot dot-${tone}`;
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className={dot} aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}

/** Pill with a dot, used in page headers ("Needs a reply · due in 18 min"). */
export function StatusPill({
  tone,
  children,
}: {
  tone: "gold" | "steel" | "success" | "danger";
  children: ReactNode;
}) {
  return (
    <span className="pill pill-outline h-9 gap-2 text-[14px]">
      <span className={tone === "steel" ? "dot" : `dot dot-${tone}`} aria-hidden="true" />
      {children}
    </span>
  );
}

/** Call / Text / Email trio for a contact. Renders only the channels on file. */
export function ContactButtons({
  phone,
  email,
  size = "sm",
  className = "",
}: {
  phone?: string | null;
  email?: string | null;
  size?: "sm" | "md";
  className?: string;
}) {
  const btn = size === "sm" ? "btn btn-secondary h-9 px-3.5 text-[14px]" : "btn btn-secondary btn-sm";
  if (!phone && !email) return null;
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {phone ? (
        <a href={`tel:${phone}`} className={btn}>
          Call
        </a>
      ) : null}
      {phone ? (
        <a href={`sms:${phone}`} className={btn}>
          Text
        </a>
      ) : null}
      {email ? (
        <a href={`mailto:${email}`} className={btn}>
          Email
        </a>
      ) : null}
    </div>
  );
}

/** Big Fraunces number card for Reports / Clients counters. */
export function NumberCard({
  label,
  value,
  note,
  noteTone = "steel",
}: {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  noteTone?: "steel" | "success" | "gold" | "danger" | "bone";
}) {
  const tone =
    noteTone === "bone"
      ? "text-bone-2"
      : noteTone === "steel"
        ? "text-steel"
        : `text-${noteTone}`;
  return (
    <div className="card p-6">
      <div className="text-[14px] text-steel">{label}</div>
      <div className="mt-2 font-serif text-[44px] font-light leading-none tracking-[-0.02em] text-bone">{value}</div>
      {note ? <div className={`mt-2 text-[14px] ${tone}`}>{note}</div> : null}
    </div>
  );
}

/** Section card with a 13px steel heading, as in the one-request page. */
export function DeskCard({
  title,
  children,
  className = "",
  actions,
  id,
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className={`card p-5 ${className}`}>
      {title || actions ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {title ? <h2 className="label-jn text-[13px]">{title}</h2> : <span />}
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}
