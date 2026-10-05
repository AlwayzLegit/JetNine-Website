const STEPS = [
  { n: "01", title: "Tell us your plans", body: "Share your route, timing and preferences." },
  { n: "02", title: "Compare your options", body: "Review aircraft choices and an itemized quote." },
  { n: "03", title: "Make it yours", body: "Confirm your flight and refine the details." },
];

/**
 * "A simpler way to fly private." — navy band: intro left, a thin
 * vertical rule, then the three numbered steps on the right. Anchor
 * target for the hero's "Discover the JetNine approach" link.
 */
export function Flow() {
  return (
    <section id="how" className="on-navy mt-14 bg-navy">
      <div className="container-jn flex flex-wrap items-center gap-12 py-12">
        <div className="min-w-0 flex-[999_1_240px]">
          <h2 className="title-section">
            A simpler way
            <br />
            to fly private.
          </h2>
          <p className="mt-[18px] max-w-[32ch] font-serif text-[19px] leading-[1.45]">
            One conversation. Thoughtful options.
            <br />
            Every detail considered.
          </p>
        </div>
        <div aria-hidden className="min-h-[160px] min-w-0 max-w-full flex-[1_1_1px] self-stretch bg-[rgba(255,255,255,0.28)]" />
        <ol className="m-0 min-w-0 flex-[999_1_240px] list-none p-0">
          {STEPS.map((s) => (
            <li key={s.n} className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-4 border-b border-line py-4 font-serif">
              <span className="text-[36px] leading-none text-gold">{s.n}</span>
              <div>
                <div className="text-[21px] leading-[1.2]">{s.title}</div>
                <div className="mt-[2px] text-[14px] text-bone-2">{s.body}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
