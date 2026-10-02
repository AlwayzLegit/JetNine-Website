import Link from "next/link";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { trips, tripLegs } from "@/db/schema/trips";
import { members } from "@/db/schema/members";
import { users } from "@/db/schema/users";
import { formatUSD } from "@/lib/quote-pricing";

export const dynamic = "force-dynamic";

const STATUS_CLASS: Record<string, string> = {
  draft: "border-ink-3 text-bone-2",
  confirmed: "border-clearance text-clearance",
  crew_briefed: "border-bone text-bone",
  boarding: "border-bone text-bone",
  airborne: "border-[var(--warn)] text-[var(--warn)]",
  wheels_down: "border-bone-2 text-bone-2",
  completed: "border-[var(--success)] text-[var(--success)]",
  cancelled_wx: "border-[var(--error)] text-[var(--error)]",
  cancelled_other: "border-[var(--error)] text-[var(--error)]",
  diverted: "border-[var(--warn)] text-[var(--warn)]",
  irregular_ops: "border-[var(--error)] text-[var(--error)]",
};

export default async function AdminTripsPage() {
  const rows = await db
    .select({
      id: trips.id,
      tripCode: trips.tripCode,
      status: trips.status,
      paxCount: trips.paxCount,
      missionType: trips.missionType,
      revenueUsd: trips.revenueUsd,
      wheelsUpAt: trips.wheelsUpAt,
      createdAt: trips.createdAt,
      memberId: trips.memberId,
      memberCode: members.memberCode,
      memberEmail: users.email,
      memberFirstName: users.firstName,
      memberLastName: users.lastName,
    })
    .from(trips)
    .innerJoin(members, eq(members.id, trips.memberId))
    .innerJoin(users, eq(users.id, members.userId))
    .orderBy(desc(trips.createdAt))
    .limit(100);

  const ids = rows.map((r) => r.id);
  const legs = ids.length
    ? await db
        .select({
          tripId: tripLegs.tripId,
          legNumber: tripLegs.legNumber,
          fromIata: tripLegs.fromIata,
          toIata: tripLegs.toIata,
        })
        .from(tripLegs)
        .where(inArray(tripLegs.tripId, ids))
        .orderBy(asc(tripLegs.legNumber))
    : [];
  const legsByTrip = new Map<string, typeof legs>();
  for (const l of legs) {
    const arr = legsByTrip.get(l.tripId) ?? [];
    arr.push(l);
    legsByTrip.set(l.tripId, arr);
  }

  const totals = {
    total: rows.length,
    confirmed: rows.filter((r) => ["confirmed", "crew_briefed", "boarding"].includes(r.status))
      .length,
    inFlight: rows.filter((r) => r.status === "airborne").length,
    completed: rows.filter((r) => r.status === "completed").length,
  };

  return (
    <div className="container-jn py-10">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="caption mb-3">— Admin · trips</p>
          <h1 className="font-serif text-[36px] font-light leading-tight tracking-tight text-bone">
            {totals.total} trips on the books.
          </h1>
          <p className="mt-3 max-w-[60ch] text-[14px] leading-[1.55] text-bone-2">
            Booked flights, newest first. Each trip carries a JN-YYYY-NNNN ref and a draft invoice.
            Full trip sheet (manifest, crew, catering, ground) lands in C.3.
          </p>
        </div>
        <dl className="flex flex-wrap gap-x-10 gap-y-3 text-right">
          {[
            ["TOTAL", String(totals.total)],
            ["CONFIRMED", String(totals.confirmed)],
            ["IN-FLIGHT", String(totals.inFlight)],
            ["COMPLETED", String(totals.completed)],
          ].map(([lbl, val]) => (
            <div key={lbl} className="flex flex-col items-end">
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">{lbl}</dt>
              <dd
                className={[
                  "mt-1 font-serif text-[26px] font-light leading-none",
                  lbl === "IN-FLIGHT" && totals.inFlight > 0
                    ? "text-[var(--warn)]"
                    : "text-bone",
                ].join(" ")}
              >
                {val}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-[4px] border border-ink-3 bg-ink-2 p-12 text-center">
          <p className="caption mb-3">— No trips yet</p>
          <h2 className="font-serif text-[24px] font-normal text-bone">Convert a quote to start.</h2>
          <p className="mx-auto mt-3 max-w-[48ch] text-[14px] leading-[1.55] text-bone-2">
            Open any quote in{" "}
            <Link href="/admin/dispatch" className="text-clearance">
              dispatch
            </Link>
            , click <em>Convert to trip</em>, and it lands here with a JN-YYYY-NNNN ref + a draft
            invoice.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[4px] border border-ink-3 bg-ink-2">
          <table className="w-full min-w-[1080px] border-collapse text-left">
            <thead>
              <tr className="border-b border-ink-3">
                {[
                  "Ref",
                  "Route",
                  "Member",
                  "Pax",
                  "Mission",
                  "Revenue",
                  "Status",
                  "Created",
                  "",
                ].map((h, i) => (
                  <th
                    key={h || i}
                    className="px-5 py-4 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const route =
                  (legsByTrip.get(t.id) ?? [])
                    .map((l) => `${l.fromIata ?? "—"}→${l.toIata ?? "—"}`)
                    .join(" · ") || "—";
                const name =
                  [t.memberFirstName, t.memberLastName].filter(Boolean).join(" ") || t.memberEmail;
                return (
                  <tr key={t.id} className="border-b border-ink-3 transition-colors hover:bg-ink">
                    <td className="px-5 py-5 font-mono text-[12px] tracking-[0.04em] text-clearance">
                      {t.tripCode}
                    </td>
                    <td className="px-5 py-5 font-mono text-[11px] tracking-[0.04em] text-bone">
                      {route}
                    </td>
                    <td className="px-5 py-5">
                      <div className="text-[13px] text-bone">{name}</div>
                      <div className="font-mono text-[10px] tracking-[0.04em] text-bone-2">
                        {t.memberCode}
                      </div>
                    </td>
                    <td className="px-5 py-5 font-mono text-[12px] tracking-[0.04em] text-bone">
                      {t.paxCount}
                    </td>
                    <td className="px-5 py-5 font-mono text-[10px] uppercase tracking-[0.08em] text-bone-2">
                      {t.missionType.replace(/_/g, " ")}
                    </td>
                    <td className="px-5 py-5 font-mono text-[12px] tracking-[0.04em] text-bone">
                      {t.revenueUsd ? formatUSD(t.revenueUsd) : "—"}
                    </td>
                    <td className="px-5 py-5">
                      <span
                        className={[
                          "inline-block rounded-full border px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]",
                          STATUS_CLASS[t.status] ?? "border-ink-3 text-bone-2",
                        ].join(" ")}
                      >
                        {t.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-5 py-5 font-mono text-[10px] tracking-[0.04em] text-bone-2">
                      {t.createdAt.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-5 py-5 text-right">
                      <Link
                        href={`/admin/trip/${t.id}`}
                        className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-clearance"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
