const STEPS = [
  {
    num: "01",
    title: "Request",
    body: "Tell us where, when, and how many. Sixty-second form, or call dispatch direct.",
  },
  {
    num: "02",
    title: "Match",
    body: "We surface three to five vetted aircraft within minutes — with all-in pricing.",
  },
  {
    num: "03",
    title: "Fly",
    body: "Show up. We handle catering, ground, customs, crew. You board.",
  },
];

export function Flow() {
  return (
    <section id="how" className="container-jn section-jn-lg max-md:pt-16">
      <p className="eyebrow">The flow</p>
      <h2 className="title-section max-w-[20ch]">From request to wheels-up.</h2>

      <ol className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3 max-md:mt-6">
        {STEPS.map((s) => (
          <li key={s.num} className="card p-8 max-md:p-6">
            <div
              className="font-serif text-[48px] font-light leading-none text-clearance"
              aria-hidden="true"
            >
              {s.num}
            </div>
            <h3 className="title-card mt-6 mb-2 max-md:mt-4">{s.title}</h3>
            <p className="text-bone-2">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
