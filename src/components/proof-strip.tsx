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
 *
 * Presentation follows the Home trust bar: Fraunces value over a 14px
 * steel label, one card per fact, a horizontal strip on phones.
 */
const PROOF: { big: string; label: string; href: string }[] = [
  { big: "380 of ~5,000", label: "US operators pass our vetting", href: "/safety/operator-vetting" },
  { big: "ARG/US Gold floor", label: "Platinum on 78% of flights", href: "/safety/ratings-explained" },
  { big: "Wyvern Wingman", label: "Required on international and ultra-long-range flights", href: "/safety/ratings-explained" },
  { big: "3,500 hr minimum", label: "Two ATP pilots, in-type, every flight", href: "/safety/pilot-standards" },
  { big: "Guarantee, in writing", label: "Substitute aircraft or credit — no fight", href: "/memberships" },
];

const cell =
  "flex min-w-[200px] flex-1 flex-col justify-center gap-1.5 px-6 py-6 md:min-w-0 md:border-r md:border-line md:last:border-r-0";

export function ProofStrip() {
  const reviewScore = process.env.NEXT_PUBLIC_REVIEW_SCORE;
  const reviewSource = process.env.NEXT_PUBLIC_REVIEW_SOURCE;

  return (
    <section aria-label="Safety and trust standards" className="border-y border-line bg-ink-2">
      <div className="container-jn">
        <div className="-mx-[var(--pad-x)] flex overflow-x-auto px-[var(--pad-x)] md:mx-0 md:grid md:grid-cols-5 md:overflow-visible md:px-0 max-md:divide-x max-md:divide-line">
          {reviewScore && reviewSource ? (
            <div className={cell}>
              <span className="font-serif text-[26px] font-light leading-tight tracking-tight text-bone">
                {reviewScore}★ {reviewSource}
              </span>
              <span className="text-[14px] text-steel">Verified client reviews</span>
            </div>
          ) : null}
          {PROOF.map((p) => (
            <Link key={p.big} href={p.href} className={`${cell} group transition-colors hover:bg-surface`}>
              <span className="font-serif text-[26px] font-light leading-tight tracking-tight text-bone">
                {p.big}
              </span>
              <span className="text-[14px] text-steel transition-colors group-hover:text-bone-2">
                {p.label} <span className="arrow">→</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
