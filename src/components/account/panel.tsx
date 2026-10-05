import Link from "next/link";

// Shared presentation grammar for the member account (Light - Account):
// square bordered panels on white, bronze small-caps eyebrows, 40px serif
// page titles with a 15px steel sentence underneath, underlined 13px
// text buttons for "All quotes" style links.

/** A bordered panel. Add padding per use (`px-5 py-[18px]` / `px-6 py-[22px]`). */
export const PANEL = "border border-line bg-surface";

/** Inner tile inside a panel (paper on white). */
export const TILE = "border border-line bg-ink";

/** Secondary 40px button from the prototype (white, line border). */
export const BTN_LINE =
  "inline-flex h-10 items-center justify-center rounded-control border border-line bg-surface px-4 text-[14px] text-bone transition-colors hover:border-steel hover:text-bone";

/** Secondary 40px button with a navy border (the stronger of the two). */
export const BTN_NAVY_LINE =
  "inline-flex h-10 items-center justify-center rounded-control border border-bone bg-surface px-4 text-[14px] text-bone transition-colors hover:bg-surface-2";

/** Primary 42px navy button. */
export const BTN_PRIMARY =
  "inline-flex h-[42px] items-center justify-center gap-2.5 rounded-control bg-clearance px-5 text-[14px] font-bold text-white transition-colors hover:bg-clearance-hover hover:text-white";

export function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={["text-[12px] font-bold uppercase tracking-[.2em] text-gold", className].join(" ")}>{children}</p>
  );
}

/** Underlined 13px text link ("All quotes", "Manage", "Receipt"). */
export function UnderLink({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={[
        "text-[13px] text-bone underline underline-offset-[3px] transition-colors hover:text-gold",
        className,
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

/**
 * Page head: serif title, steel sentence, optional action on the right
 * (wraps under the title on narrow screens).
 */
export function PageHead({
  title,
  sub,
  action,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-serif text-[clamp(32px,6vw,40px)] font-normal leading-[1.05] text-bone">{title}</h1>
        {sub ? <p className="mt-1.5 max-w-[68ch] text-[15px] text-steel">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Serif 24px section title with an optional underlined link on the right. */
export function SectionTitle({
  children,
  href,
  linkText,
  className = "",
}: {
  children: React.ReactNode;
  href?: string;
  linkText?: string;
  className?: string;
}) {
  return (
    <div className={["flex items-baseline justify-between gap-4", className].join(" ")}>
      <h2 className="font-serif text-[24px] font-normal text-bone">{children}</h2>
      {href && linkText ? <UnderLink href={href}>{linkText}</UnderLink> : null}
    </div>
  );
}

/** Empty-state panel: serif line, sentence, optional action. */
export function EmptyPanel({
  title,
  children,
  action,
  className = "mt-[22px]",
}: {
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={[PANEL, "px-6 py-[22px] max-md:px-5", className].join(" ")}>
      {title ? <h2 className="font-serif text-[22px] font-normal leading-[1.15] text-bone">{title}</h2> : null}
      <div className={["max-w-[60ch] text-[15px] leading-[1.55] text-steel", title ? "mt-2" : ""].join(" ")}>
        {children}
      </div>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
