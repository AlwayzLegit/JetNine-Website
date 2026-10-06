// The Light quote "dialog" (Quote.dc) as an in-page panel: white, 1px
// line border, 4px radius, a soft navy shadow and the prototype's
// `28px clamp(16px,4vw,32px) 24px` padding. Each step renders one panel
// with a PanelHeader on top; the layout centres it in a 760px column.

export function QuotePanel({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section";
}) {
  return (
    <Tag
      className={[
        "min-w-0 rounded-card border border-line bg-surface px-[clamp(16px,4vw,32px)] pb-6 pt-7 shadow-[0_18px_48px_rgba(9,24,34,0.08)]",
        className,
      ].join(" ")}
    >
      {children}
    </Tag>
  );
}

/**
 * Eyebrow "Request a quote", the step title as the page's h1 (serif,
 * 32px in the prototype — a touch larger on desktop since this is a page,
 * not a modal), then the 15px steel lead ending "Step n of 4."
 */
export function PanelHeader({
  step,
  title,
  children,
}: {
  step: 1 | 2 | 3 | 4;
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header>
      <p className="eyebrow !mb-2.5">Request a quote</p>
      <h1 className="font-serif text-[clamp(30px,4.4vw,38px)] font-normal leading-[1.1] text-bone">{title}</h1>
      <p className="mt-2 max-w-[62ch] text-[15px] leading-[1.55] text-steel">
        {children}
        {children ? " " : null}Step {step} of 4.
      </p>
    </header>
  );
}

/** 12px bronze uppercase label used for leg titles and in-panel groups. */
export function PanelLabel({
  children,
  className = "",
  as: Tag = "div",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "h2" | "h3" | "p";
  id?: string;
}) {
  return (
    <Tag
      id={id}
      className={[
        "text-[12px] font-semibold uppercase leading-[1.4] tracking-[0.18em] text-gold",
        className,
      ].join(" ")}
    >
      {children}
    </Tag>
  );
}
