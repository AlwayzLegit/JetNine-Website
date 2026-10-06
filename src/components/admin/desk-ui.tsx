import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Desk UI primitives — light admin grammar (Light - Admin *.dc.html).
 * Server components — no state. Every admin section composes these so the
 * desk reads as one product:
 *
 *   <DeskPage>                       main column, 22px/28px padding
 *     <DeskHeader title lead actions />   serif 40–44px title, steel lead
 *     <DeskTabs items current base />     bronze-underlined tabs
 *     <DeskGroup index title hint>        "01 / TITLE" bronze overline + card
 *       <DeskRow … />
 *     </DeskGroup>
 *     <DeskEmpty title body />
 *
 * Panels use the prototype's warm off-white (#FBFAF7) on the paper page;
 * lists sit on white. The two warm tints (#FBFAF7 panel, #F1EADF "now")
 * have no global token — they live here so every page shares them.
 */

/** Warm panel: hairline border on #FBFAF7 (cards, side panels, KPI tiles). */
export const DESK_PANEL = "border border-line bg-[#FBFAF7]";
/** Bronze-tinted fill for "current" stage, internal notes, highlights. */
export const DESK_TINT = "bg-[#F1EADF]";
/** Small white bordered button (Call / Text / Email, "Open in Avinode ↗"). */
export const DESK_MINI_BTN =
  "inline-flex h-11 items-center justify-center whitespace-nowrap border border-line bg-surface px-3 text-[13px] text-bone transition-colors hover:border-bone md:h-8";

export function DeskPage({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 max-w-[1296px] px-4 pb-16 pt-5 md:px-7 md:pb-10 md:pt-[22px] ${className}`}>
      {children}
    </div>
  );
}

/** 12px bronze uppercase overline used for every section label on the desk. */
export function DeskOverline({
  children,
  as: Tag = "p",
  className = "",
}: {
  children: ReactNode;
  as?: "p" | "h2" | "h3" | "span";
  className?: string;
}) {
  return (
    <Tag className={`text-[12px] font-bold uppercase leading-[1.4] tracking-[0.2em] text-gold ${className}`}>
      {children}
    </Tag>
  );
}

export function DeskHeader({
  title,
  lead,
  back,
  actions,
  size = "lg",
  className = "",
}: {
  title: ReactNode;
  lead?: ReactNode;
  /** "← All requests" style link above the title. */
  back?: { href: string; label: string };
  actions?: ReactNode;
  /** lg = section index (40–44px); md = one record / settings page (32–36px). */
  size?: "lg" | "md";
  className?: string;
}) {
  const titleCls =
    size === "lg"
      ? "text-[clamp(32px,4vw,44px)] leading-[1.05] tracking-[-0.01em]"
      : "text-[clamp(26px,3vw,34px)] leading-[1.1]";
  return (
    <div className={className}>
      {back ? (
        <Link
          href={back.href}
          className="inline-flex min-h-11 items-center text-[13px] text-steel transition-colors hover:text-bone md:min-h-0"
        >
          ← {back.label}
        </Link>
      ) : null}
      <div className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-4 ${back ? "md:mt-2" : "md:mt-3"}`}>
        <div className="min-w-0">
          <h1 className={`font-serif font-normal text-bone ${titleCls}`}>{title}</h1>
          {lead ? <p className="mt-1.5 text-[15px] leading-[1.5] text-steel md:text-[16px]">{lead}</p> : null}
        </div>
        {actions ? <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto">{actions}</div> : null}
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
  width = 240,
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
    <form action={action} method="get" role="search" className="flex w-full sm:w-auto">
      {hidden
        ? Object.entries(hidden)
            .filter(([, v]) => v)
            .map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)
        : null}
      <input
        type="search"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label={placeholder}
        style={{ ["--w" as string]: typeof width === "number" ? `${width}px` : width }}
        className="h-11 w-full min-w-0 rounded-[3px] border border-line bg-surface px-3 text-[15px] text-bone outline-none placeholder:text-steel-dim focus:border-bone sm:w-[var(--w)] md:h-10"
      />
    </form>
  );
}

export type DeskTab = { key: string; label: string; count?: number; href?: string };

/**
 * Tabs rendered as links (`?tab=key` on `base` unless `href` is given), so
 * the list filters server-side and the URL is shareable.
 *
 *  - `line` (default): 14px labels on a hairline, current one bold with a
 *    2px bronze underline (Trips / Clients / Messages prototypes).
 *  - `band`: white 48px band with hairlines top and bottom, equal columns
 *    split by hairlines (Requests prototype). Scrolls sideways on phones.
 *  - `chips`: small pill filters that wrap (Messages / Reports prototypes);
 *    current one filled navy.
 */
export function DeskTabs({
  items,
  current,
  base,
  param = "tab",
  keep,
  variant = "line",
  className = "",
}: {
  items: DeskTab[];
  current: string;
  base: string;
  param?: string;
  /** Other params to keep when switching tabs (q, period…). */
  keep?: Record<string, string | undefined>;
  variant?: "line" | "band" | "chips";
  className?: string;
}) {
  const qs = (key: string) => {
    const p = new URLSearchParams();
    if (keep) for (const [k, v] of Object.entries(keep)) if (v) p.set(k, v);
    p.set(param, key);
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };
  const band = variant === "band";
  if (variant === "chips") {
    return (
      <div role="tablist" className={`flex flex-wrap gap-1.5 ${className}`}>
        {items.map((t) => {
          const active = t.key === current;
          return (
            <Link
              key={t.key}
              role="tab"
              aria-selected={active}
              aria-current={active ? "page" : undefined}
              href={t.href ?? qs(t.key)}
              className={`inline-flex h-9 items-center whitespace-nowrap rounded-pill border px-2.5 text-[12px] transition-colors md:h-7 ${
                active ? "border-clearance bg-clearance text-white" : "border-line bg-surface text-bone hover:border-bone"
              }`}
            >
              {t.label}
              {typeof t.count === "number" && t.count > 0 ? <span>&nbsp;·&nbsp;{t.count}</span> : null}
            </Link>
          );
        })}
      </div>
    );
  }
  return (
    <div
      role="tablist"
      className={
        band
          ? `flex overflow-x-auto border-y border-line bg-surface md:grid md:auto-cols-fr md:grid-flow-col ${className}`
          : `flex gap-[18px] overflow-x-auto border-b border-line ${className}`
      }
    >
      {items.map((t, i) => {
        const active = t.key === current;
        return (
          <Link
            key={t.key}
            role="tab"
            aria-selected={active}
            aria-current={active ? "page" : undefined}
            href={t.href ?? qs(t.key)}
            className={[
              "flex flex-none items-center justify-center whitespace-nowrap text-[14px] text-bone transition-colors hover:text-gold",
              band ? `h-12 px-4 ${i > 0 ? "border-l border-line" : ""}` : "min-h-11 py-2 md:min-h-0",
              active ? "font-semibold shadow-[inset_0_-2px_0_0_var(--gold)]" : "font-normal",
            ].join(" ")}
          >
            {t.label}
            {typeof t.count === "number" ? <span>&nbsp;·&nbsp;{t.count}</span> : null}
          </Link>
        );
      })}
    </div>
  );
}

/**
 * Bronze overline ("01 / Needs a reply") + an optional steel hint on the
 * right, then either one white card that clips its rows (default) or a
 * stack of separate row cards (`stack`, Trips prototype).
 */
export function DeskGroup({
  title,
  count,
  index,
  hint,
  children,
  className = "mt-7",
  aside,
  stack = false,
}: {
  title: ReactNode;
  count?: number;
  /** 1-based position, rendered "01 / ". */
  index?: number;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  aside?: ReactNode;
  stack?: boolean;
}) {
  return (
    <section className={className}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <DeskOverline as="h2">
          {typeof index === "number" ? `${String(index).padStart(2, "0")} / ` : null}
          {title}
          {typeof count === "number" ? <span> · {count}</span> : null}
        </DeskOverline>
        {hint ? <span className="text-[13px] text-steel">{hint}</span> : null}
        {aside}
      </div>
      {stack ? (
        <div className="mt-2.5 flex flex-col gap-2.5">{children}</div>
      ) : (
        <div className="mt-2.5 overflow-hidden rounded-[3px] border border-line bg-surface">{children}</div>
      )}
    </section>
  );
}

/**
 * One row inside a DeskGroup. Grid columns are the caller's (Requests uses
 * `minmax(0,1fr) 230px 110px`); rows separate with a hairline. `card` makes
 * the row its own warm panel (stacked groups); `hot` gives it a bronze edge.
 */
export function DeskRow({
  children,
  className = "",
  cols = "md:grid-cols-[minmax(0,1fr)_230px_110px]",
  href,
  card = false,
  hot = false,
}: {
  children: ReactNode;
  className?: string;
  cols?: string;
  href?: string;
  card?: boolean;
  hot?: boolean;
}) {
  const shell = card
    ? `border bg-[#FBFAF7] px-4 py-3.5 md:px-[18px] ${hot ? "border-gold" : "border-line"}`
    : "border-b border-line px-4 py-4 last:border-b-0 md:px-5";
  // Callers may set their own phone columns (`grid-cols-[…]`); default to one.
  const phoneCols = /(^|\s)grid-cols-/.test(cols) ? "" : "grid-cols-1";
  const cls = `grid ${phoneCols} items-center gap-3 md:gap-6 ${shell} ${cols} ${className}`;
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
  className = "mt-7",
  children,
}: {
  title?: ReactNode;
  body?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`rounded-[3px] border border-line bg-surface p-8 text-center ${className}`}>
      <p className="font-serif text-[24px] leading-[1.2] text-bone">{title}</p>
      {body ? <p className="mt-1.5 text-[15px] text-steel">{body}</p> : null}
      {children ? <div className="mt-5 flex flex-wrap justify-center gap-2.5">{children}</div> : null}
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

/**
 * Status pill in a page header ("Needs a reply · due in 18 min"). Gold =
 * bronze edge on the warm tint (needs you); success = navy fill (done);
 * danger = red edge; steel = plain white.
 */
export function StatusPill({
  tone,
  children,
}: {
  tone: "gold" | "steel" | "success" | "danger";
  children: ReactNode;
}) {
  const cls =
    tone === "gold"
      ? "border-gold bg-[#F1EADF] text-bone"
      : tone === "success"
        ? "border-clearance bg-clearance text-white"
        : tone === "danger"
          ? "border-danger bg-surface text-danger"
          : "border-line bg-surface text-bone";
  return (
    <span
      className={`inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-pill border px-3 text-[13px] ${cls}`}
    >
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
  const btn = size === "sm" ? DESK_MINI_BTN : "btn btn-secondary btn-sm";
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

/** Serif number tile (Reports KPIs, Clients counters, reference totals). */
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
    <div className={`${DESK_PANEL} px-5 py-[18px]`}>
      <div className="text-[12px] text-steel">{label}</div>
      <div className="mt-1 font-serif text-[clamp(30px,3.4vw,40px)] font-normal leading-none text-bone">{value}</div>
      {note ? <div className={`mt-1.5 text-[13px] ${tone}`}>{note}</div> : null}
    </div>
  );
}

/** Warm section panel with a bronze overline heading (one-request page). */
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
    <section id={id} className={`${DESK_PANEL} px-4 py-4 md:px-[18px] ${className}`}>
      {title || actions ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {title ? <DeskOverline as="h2">{title}</DeskOverline> : <span />}
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}
