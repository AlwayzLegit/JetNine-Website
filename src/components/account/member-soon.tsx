type Section = {
  key: string;
  kicker: string;
  title: string;
  body: string;
  rows: string[];
};

const SECTIONS: Record<string, Section> = {
  trips: {
    key: "trips",
    kicker: "Trips",
    title: "Your past and upcoming flights.",
    body: "Once Phase C.2 of the schema lands (trips + trip_legs + manifest), this page lists every flight you've taken, the operator, the airframe, the crew, and the trip sheet PDF.",
    rows: [
      "Filter by upcoming / in-flight / past / cancelled",
      "Per-trip detail with manifest, crew, FBO instructions",
      "Trip sheet PDFs delivered 24h before wheels-up",
    ],
  },
  invoices: {
    key: "invoices",
    kicker: "Invoices",
    title: "Outstanding, paid, and credit memos.",
    body: "Phase C.2 ships invoices + line items + payment methods. This view will show open balance, payment status, and downloadable receipts with the broker disclosure footer.",
    rows: [
      "Outstanding · paid · credit · void status filtering",
      "ACH / wire / card payment with processor fee transparency",
      "PDF receipts with FET line + segment fee per pax",
    ],
  },
  preferences: {
    key: "preferences",
    kicker: "Preferences",
    title: "Cabin, catering, ground, comms.",
    body: "Phase A.2 ships member_preferences. This page will let you set defaults that follow you on every quote — Wi-Fi requirement, catering tier, FBO of record, quiet hours, anonymized manifests.",
    rows: [
      "Cabin: Wi-Fi · stand-up · lie-flat · pet · attendant",
      "Catering tier + dietary notes + standing bar",
      "Ground vendor + arrival-window minutes",
      "Comms: voice / email / SMS preferences with quiet hours",
    ],
  },
  members: {
    key: "members",
    kicker: "Membership",
    title: "Tier, balance, activity ledger.",
    body: "Phase C.3 ships memberships + reserve_transactions. This page surfaces your card / Reserve tier, your refundable deposit balance, cashback accruals, and an exportable ledger.",
    rows: [
      "Card / Reserve program with tier and rate-lock dates",
      "Refundable deposit balance + recent transactions",
      "Cashback accrual at trip completion",
      "Named cardholders + companion list",
    ],
  },
};

export function MemberSoon({ section }: { section: keyof typeof SECTIONS }) {
  const s = SECTIONS[section];
  return (
    <section className="container-jn py-12">
      <header className="mb-12 border-b border-ink-3 pb-8">
        <p className="caption mb-4">— Account · {s.kicker}</p>
        <h1 className="font-serif text-[40px] font-light leading-tight tracking-tight text-bone">
          {s.title}
        </h1>
        <p className="mt-5 max-w-[64ch] text-[16px] leading-[1.6] text-bone-2">{s.body}</p>
      </header>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {s.rows.map((r) => (
          <li
            key={r}
            className="grid grid-cols-[auto_1fr] items-baseline gap-3 rounded-[3px] border border-ink-3 bg-ink-2 px-5 py-4 text-[14px] leading-[1.55] text-bone"
          >
            <span className="text-clearance">—</span>
            <span>{r}</span>
          </li>
        ))}
      </ul>
      <p className="mt-10 max-w-[60ch] font-mono text-[10px] uppercase tracking-[0.12em] text-steel">
        — Roadmap stub. Page is wired into the account shell so the
        /account dashboard cards resolve.
      </p>
    </section>
  );
}
