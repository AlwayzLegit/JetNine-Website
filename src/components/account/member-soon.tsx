type Section = {
  key: string;
  title: string;
  body: string;
  rows: string[];
};

// Roadmap stubs for account sections that are not wired up yet. Plain
// words only: passengers, aircraft, private terminal.
const SECTIONS: Record<string, Section> = {
  trips: {
    key: "trips",
    title: "Trips",
    body: "Soon this page lists every flight you've taken — the operator, the aircraft, the crew and the trip sheet.",
    rows: [
      "Filter by upcoming, in flight, past and cancelled",
      "Per-trip detail with passengers, crew and where to go",
      "Trip sheets delivered 24 hours before departure",
    ],
  },
  invoices: {
    key: "invoices",
    title: "Invoices",
    body: "Soon this page shows your open balance, payment status and downloadable receipts.",
    rows: [
      "Outstanding, paid and credited invoices",
      "Pay by bank transfer, wire or card",
      "Receipts with tax and per-passenger segment fees itemised",
    ],
  },
  preferences: {
    key: "preferences",
    title: "Preferences",
    body: "Soon you can set defaults that follow you on every quote — Wi-Fi, catering, your preferred private terminal, quiet hours.",
    rows: [
      "Cabin: Wi-Fi, stand-up cabin, lie-flat seats, pets, flight attendant",
      "Catering tier, dietary notes and a standing bar",
      "Ground transport and arrival window",
      "How we reach you: phone, email or text, with quiet hours",
    ],
  },
  members: {
    key: "members",
    title: "Membership",
    body: "Soon this page shows your card or reserve program, your refundable balance, cashback and every transaction.",
    rows: [
      "Card or reserve program with its rate-lock dates",
      "Refundable balance and recent activity",
      "Cashback added when a trip completes",
      "Named cardholders and companions",
    ],
  },
};

export function MemberSoon({ section }: { section: keyof typeof SECTIONS }) {
  const s = SECTIONS[section];
  return (
    <>
      <h1 className="title-app text-bone">{s.title}</h1>
      <p className="mt-2.5 max-w-[60ch] text-[17px] text-bone-2">{s.body}</p>
      <section className="card mt-8">
        <h2 className="label-jn px-7 pt-6 text-[13px]">What&rsquo;s coming</h2>
        <ul className="mt-3 divide-y divide-line-faint">
          {s.rows.map((r) => (
            <li key={r} className="grid grid-cols-[auto_1fr] gap-2.5 px-7 py-4 text-[15px] text-bone">
              <span className="text-clearance" aria-hidden="true">
                ✓
              </span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </section>
      <p className="mt-6 max-w-[60ch] text-[14px] leading-[1.55] text-steel">
        Until then, dispatch handles all of this by phone or email.
      </p>
    </>
  );
}
