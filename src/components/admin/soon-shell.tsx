type Section = {
  key: string;
  title: string;
  body: string;
  blocks: string[];
};

const SECTIONS: Record<string, Section> = {
  "quote-list": {
    key: "quote-list",
    title: "Quote workbench (list view)",
    body: "Pick a quote from the inbox to open the workbench.",
    blocks: ["List view will land in v2 — for now use /admin/dispatch."],
  },
  ops: {
    key: "ops",
    title: "Live ops board",
    body: "Aircraft in the air right now, fuel status, eta, weather flags. Pulls from trips + trip_legs once Phase C.2 lands.",
    blocks: [
      "Live FlightAware integration · per-tail status · diversion alerts",
      "Crew-on-duty list · current FBO · current passengers manifest",
      "WX overlay · TFR alerts · ATC slot status",
    ],
  },
  trip: {
    key: "trip",
    title: "Trip sheet",
    body: "Per-trip booking record with manifest, crew, catering, ground, FBO instructions, audit log.",
    blocks: [
      "Manifest editor with APIS encryption for passport / KTN",
      "Crew assignment + duty-time tracking",
      "Catering + ground sub-orders with vendor accounts",
      "Trip versioning + member email on every change",
    ],
  },
  member: {
    key: "member",
    title: "Member CRM",
    body: "360° view of a member: profile, trips, invoices, balance, preferences, lanes, companions, rules.",
    blocks: [
      "Search across members + filter by tier / dispatcher",
      "Profile edit (name, contact, billing) with audit log",
      "Lifetime activity timeline · spend · most-flown lanes",
      "Reserve balance + transaction ledger",
    ],
  },
  operators: {
    key: "operators",
    title: "Operators directory",
    body: "148 operators with vetting state, insurance, audit cycle, suspended flag.",
    blocks: [
      "ARG/US + Wyvern + IS-BAO ratings per row",
      "Audit due-date alerts · suspended-state overrides",
      "Per-operator aircraft list + contact list",
    ],
  },
  aircraft: {
    key: "aircraft",
    title: "Aircraft availability",
    body: "14-day fleet planner showing tails, blocks (confirmed trips, empty legs, ferry, maint, AOG).",
    blocks: [
      "Per-tail row x day-column grid",
      "Click a block to open trip / empty-leg / maint detail",
      "Drag to create soft-holds · highlight conflicts",
    ],
  },
  "empty-leg": {
    key: "empty-leg",
    title: "Empty-leg authoring",
    body: "Publish a repositioning leg to the live board. Auto-price decay, audience match, SMS blast.",
    blocks: [
      "Origin/destination + wheels-up time · full-charter reference price",
      "Discount slider with auto-decay schedule",
      "Visibility flags (public board, member-match, weekly digest, affiliate feed)",
      "Cascading cancel rules tied to the originating outbound charter",
    ],
  },
  reports: {
    key: "reports",
    title: "Reports",
    body: "Revenue, ops KPIs, member growth. Read off the live tables; export to CSV.",
    blocks: [
      "Quote-to-trip conversion · SLA P50/P95 · margin by category",
      "Empty-leg sell-through · operator turnover",
      "Member cohort retention · lifetime hours by tier",
    ],
  },
};

export function SoonShell({ section }: { section: keyof typeof SECTIONS }) {
  const s = SECTIONS[section];
  return (
    <div className="container-jn py-12">
      <header className="mb-12 border-b border-ink-3 pb-8">
        <p className="caption mb-4">— Admin · {s.key}</p>
        <h1 className="font-serif text-[36px] font-light leading-tight tracking-tight text-bone">
          {s.title}
        </h1>
        <p className="mt-4 max-w-[60ch] text-[15px] leading-[1.6] text-bone-2">{s.body}</p>
      </header>

      <section className="rounded-[4px] border border-dashed border-ink-3 bg-ink-2 p-12">
        <p className="caption mb-6 text-clearance">— Roadmap</p>
        <ul className="flex flex-col gap-3">
          {s.blocks.map((b) => (
            <li
              key={b}
              className="grid grid-cols-[auto_1fr] items-baseline gap-3 text-[14px] leading-[1.55] text-bone"
            >
              <span className="text-clearance">—</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <p className="mt-8 max-w-[60ch] font-mono text-[10px] uppercase tracking-[0.12em] text-steel">
          — Page wired into the admin shell so the sub-nav resolves. Real
          implementation lands after Phase B (operators/aircraft) + Phase C.2
          (trips/empty_legs) schema ships.
        </p>
      </section>
    </div>
  );
}
