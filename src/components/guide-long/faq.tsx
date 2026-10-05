export type Faq = { q: string; a: string };

/**
 * Guide FAQ accordion on native <details> (first item open, one open at
 * a time via the shared `name`). Answers stay in the HTML for search and
 * for the page's FAQPage schema, with no client JavaScript.
 *
 * - "boxed": bordered white rows, serif question, +/− on the right.
 * - "disc":  bordered rows with a bronze ring holding +/− on the left and
 *            the answer on a paper inset (the bleed-hero boards).
 * - "rule":  open list divided by rules, sans bold question (the cost,
 *            beginner and booking guides).
 */
export function FaqList({
  items,
  name,
  variant = "boxed",
  className = "",
}: {
  items: Faq[];
  name: string;
  variant?: "boxed" | "disc" | "rule";
  className?: string;
}) {
  if (variant === "rule") {
    return (
      <div className={`border-t border-line ${className}`}>
        {items.map((f, i) => (
          <details key={f.q} name={name} open={i === 0} className="group border-b border-line">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-1 py-[14px] text-[16px] font-semibold text-bone [&::-webkit-details-marker]:hidden">
              <span>{f.q}</span>
              <span aria-hidden="true" className="text-[20px] font-normal text-gold">
                <span className="group-open:hidden">+</span>
                <span className="hidden group-open:inline">−</span>
              </span>
            </summary>
            <p className="m-0 max-w-[70ch] px-1 pb-4 text-[15px] text-steel">{f.a}</p>
          </details>
        ))}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {items.map((f, i) => (
        <details key={f.q} name={name} open={i === 0} className="group border border-line bg-white">
          {variant === "disc" ? (
            <summary className="grid cursor-pointer list-none grid-cols-[22px_minmax(0,1fr)] items-center gap-[14px] px-4 py-[10px] text-bone [&::-webkit-details-marker]:hidden">
              <span
                aria-hidden="true"
                className="flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-gold text-[14px] leading-none text-gold"
              >
                <span className="group-open:hidden">+</span>
                <span className="hidden group-open:inline">−</span>
              </span>
              <span className="font-serif text-[16px]">{f.q}</span>
            </summary>
          ) : (
            <summary className="flex cursor-pointer list-none items-center justify-between gap-[14px] px-4 py-[10px] text-bone [&::-webkit-details-marker]:hidden">
              <span className="font-serif text-[16px]">{f.q}</span>
              <span aria-hidden="true" className="text-[16px] text-steel">
                <span className="group-open:hidden">+</span>
                <span className="hidden group-open:inline">−</span>
              </span>
            </summary>
          )}
          <p
            className={
              variant === "disc"
                ? "mx-3 mb-3 mt-0 bg-ink px-[14px] py-[10px] text-[13px] leading-[1.5] text-steel"
                : "m-0 px-4 pb-3 text-[13px] leading-[1.5] text-steel"
            }
          >
            {f.a}
          </p>
        </details>
      ))}
    </div>
  );
}

/** FAQPage JSON-LD for a guide's visible questions. */
export function FaqJsonLd({ items }: { items: Faq[] }) {
  const json = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  return (
    <script
      type="application/ld+json"
      // Build-time stringified site copy — not user-controlled.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
