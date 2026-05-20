import Link from "next/link";

export default function HomePage() {
  return (
    <section className="container-jn py-32">
      <p className="caption mb-6 inline-flex items-center gap-3">
        <span className="block h-px w-8 bg-clearance" />
        JetNine · v0.9 redesign · build phase 1
      </p>
      <h1 className="display-xl max-w-[18ch]">
        Ready when
        <br />
        you are.
      </h1>
      <p className="body-l mt-7 max-w-[60ch]">
        On-demand private charter, brokered through one desk. Quote in under thirty minutes,
        wheels-up on your time, one number through the whole trip.
      </p>

      <div className="mt-12 flex flex-wrap gap-6">
        <Link href="/quote" className="btn btn-primary btn-lg">
          Request a quote <span className="arrow">→</span>
        </Link>
        <Link href="/aircraft" className="btn btn-secondary btn-lg">
          See the fleet
        </Link>
      </div>

      <div className="mt-24 grid grid-cols-2 gap-8 border-t border-ink-3 pt-8 sm:grid-cols-4">
        {[
          ["— PUBLIC PAGES", "17", "Marketing + quote"],
          ["— MEMBER ACCOUNT", "5", "Logged-in shell"],
          ["— ADMIN / DISPATCH", "9", "Operational tools"],
          ["— DESIGN SYSTEM", "v0.1", "Tokens · components"],
        ].map(([label, value, sub]) => (
          <div key={label}>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">{label}</div>
            <div className="mt-2 font-serif text-[44px] font-light leading-none tracking-tight text-bone">
              {value}
            </div>
            <div className="mt-1.5 font-mono text-[10px] tracking-[0.04em] text-bone-2">{sub}</div>
          </div>
        ))}
      </div>

      <p className="caption mt-24 max-w-[60ch] text-bone-2">
        — Build status: scaffold + shared chrome complete. Next: convert the full prototype
        homepage (hero, booking widget, trust bar, value props, fleet preview, programs,
        testimonials, final CTA).
      </p>
    </section>
  );
}
