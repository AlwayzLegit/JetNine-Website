import Link from "next/link";

/**
 * Compact trust band for commercial templates (memberships, aircraft,
 * cost-calculator, category pages). Surfaces the site's strongest proof —
 * the vetting funnel, certification floor, and written guarantee — which
 * the competitor audit found buried two clicks deep while rivals lead
 * with trust on every page.
 *
 * Order follows the audited best practice: third-party review score
 * first when one exists, certifications second. The review slot is
 * env-gated (NEXT_PUBLIC_REVIEW_SCORE + NEXT_PUBLIC_REVIEW_SOURCE, e.g.
 * "4.9" + "Trustpilot") so it lights up the moment real ratings exist —
 * never hardcode a score we can't point to.
 */
const PROOF: { big: string; label: string; href: string }[] = [
  { big: "380 of ~5,000", label: "US operators pass our vetting", href: "/safety/operator-vetting" },
  { big: "ARG/US Gold floor", label: "Platinum on 78% of flights", href: "/safety/ratings-explained" },
  { big: "Wyvern Wingman", label: "Required · intl & ultra-long-range", href: "/safety/ratings-explained" },
  { big: "3,500 hr PIC min.", label: "Two ATP pilots, in-type, every flight", href: "/safety/pilot-standards" },
  { big: "Guarantee, in writing", label: "Substitute aircraft or credit — no fight", href: "/memberships" },
];

export function ProofStrip() {
  const reviewScore = process.env.NEXT_PUBLIC_REVIEW_SCORE;
  const reviewSource = process.env.NEXT_PUBLIC_REVIEW_SOURCE;

  return (
    <section aria-label="Safety and trust standards" className="border-y border-ink-3 bg-ink-2">
      <div className="container-jn flex flex-wrap items-stretch">
        {reviewScore && reviewSource ? (
          <div className="flex min-w-[170px] flex-1 flex-col justify-center gap-1.5 border-r border-ink-3 px-6 py-6">
            <span className="font-serif text-[19px] font-normal leading-tight tracking-tight text-bone">
              {reviewScore}★ {reviewSource}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-bone-2">
              Verified client reviews
            </span>
          </div>
        ) : null}
        {PROOF.map((p) => (
          <Link
            key={p.big}
            href={p.href}
            className="group flex min-w-[170px] flex-1 flex-col justify-center gap-1.5 border-r border-ink-3 px-6 py-6 transition-colors last:border-r-0 hover:bg-ink"
          >
            <span className="font-serif text-[19px] font-normal leading-tight tracking-tight text-bone">
              {p.big}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-bone-2 transition-colors group-hover:text-clearance">
              {p.label} →
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
