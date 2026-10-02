import Link from "next/link";

type Reason = {
  title: string;
  body: string;
  link?: { label: string; href: string };
};

const REASONS: Reason[] = [
  {
    title: "Safety, every flight.",
    body: "ARGUS Platinum and Wyvern Wingman vetting on every operator. No exceptions.",
    link: { label: "Read protocol", href: "/safety" },
  },
  {
    title: "No hidden fees.",
    body: "All-in pricing. No fuel surcharges. No last-minute aircraft swaps. Quoted is paid.",
  },
  {
    title: "Absolute privacy.",
    body: "NDA-level discretion. Zero public flight visibility. Crew trained for total discretion.",
  },
  {
    title: "24/7 dispatch.",
    body: "Real humans. Average response under four minutes, regardless of timezone.",
    link: { label: "Talk to dispatch", href: "/contact" },
  },
  {
    title: "Aircraft choice.",
    body: "Turboprops to ultra long-range. Six categories. You pick — we surface the right aircraft.",
  },
  {
    title: "One standard.",
    body: "First flight or fiftieth, identical execution. No tier-of-the-month.",
  },
];

export function WhyJetNine() {
  return (
    <section id="why" className="container-jn section-jn-lg max-md:pt-16">
      <p className="eyebrow">Why JetNine</p>
      <h2 className="title-section max-w-[20ch]">The standard, every flight.</h2>

      <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 max-md:mt-6">
        {REASONS.map((r) => (
          <div key={r.title} className="card card-pad max-md:p-6">
            <h3 className="title-card-sm">{r.title}</h3>
            <p className="mt-[10px] text-bone-2">{r.body}</p>
            {r.link ? (
              <Link href={r.link.href} className="text-link-strong mt-1.5 inline-flex min-h-11 items-center text-[15px]">
                {r.link.label} →
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
