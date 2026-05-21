import Link from "next/link";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { trips, tripLegs } from "@/db/schema/trips";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { getMemberByUserId } from "@/lib/member";
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

export default async function AccountTripsPage() {
  await requireUser("/account/trips");
  const user = await getCurrentUser();
  if (!user) return null;

  const member = await getMemberByUserId(user.id);

  if (!member) {
    return (
      <section className="container-jn py-12">
        <p className="caption mb-4">— Account · trips</p>
        <h1 className="font-serif text-[40px] font-light leading-tight tracking-tight text-bone">
          No trips on file yet.
        </h1>
        <p className="mt-4 max-w-[60ch] text-[16px] leading-[1.55] text-bone-2">
          Your account is signed in but doesn&rsquo;t have a member profile yet. Dispatch creates
          one when you book your first flight. Until then, kick off a quote at{" "}
          <Link href="/quote" className="text-clearance">/quote</Link>.
        </p>
      </section>
    );
  }

  const rows = await db
    .select({
      id: trips.id,
      tripCode: trips.tripCode,
      status: trips.status,
      paxCount: trips.paxCount,
      missionType: trips.missionType,
      revenueUsd: trips.revenueUsd,
      createdAt: trips.createdAt,
      wheelsUpAt: trips.wheelsUpAt,
    })
    .from(trips)
    .where(eq(trips.memberId, member.id))
    .orderBy(desc(trips.createdAt))
    .limit(50);

  const ids = rows.map((r) => r.id);
  const legs = ids.length
    ? await db
        .select({
          tripId: tripLegs.tripId,
          legNumber: tripLegs.legNumber,
          fromIata: tripLegs.fromIata,
          toIata: tripLegs.toIata,
          fromCity: tripLegs.fromCity,
          toCity: tripLegs.toCity,
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

  return (
    <section className="container-jn py-12">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="caption mb-3">— Account · trips</p>
          <h1 className="font-serif text-[40px] font-light leading-tight tracking-tight text-bone">
            Your trips · {rows.length}
          </h1>
          <p className="mt-3 max-w-[60ch] text-[14px] leading-[1.55] text-bone-2">
            Every flight tied to your member account, newest first. Trip sheet detail with
            manifest, crew, ground, and FBO instructions opens by clicking the row.
          </p>
        </div>
        <Link href="/quote" className="btn btn-secondary btn-sm">
          Start a new quote <span className="arrow">→</span>
        </Link>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-[4px] border border-ink-3 bg-ink-2 p-12 text-center">
          <p className="caption mb-3">— Empty</p>
          <h2 className="font-serif text-[24px] font-normal text-bone">No trips yet.</h2>
          <p className="mx-auto mt-3 max-w-[44ch] text-[14px] leading-[1.55] text-bone-2">
            Submit a quote and dispatch will be in touch. Once you accept an option, the trip
            shows up here with its JN-YYYY-NNNN ref.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3">
          {rows.map((t) => {
            const route =
              (legsByTrip.get(t.id) ?? [])
                .map((l) => `${l.fromIata ?? "—"} → ${l.toIata ?? "—"}`)
                .join("  ·  ") || "—";
            return (
              <li key={t.id}>
                <Link
                  href={`/account/trips/${t.id}`}
                  className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-6 rounded-[4px] border border-ink-3 bg-ink-2 px-6 py-5 transition-colors hover:border-clearance"
                >
                  <span className="font-mono text-[12px] tracking-[0.04em] text-clearance">
                    {t.tripCode}
                  </span>
                  <div>
                    <div className="font-serif text-[18px] font-normal leading-tight text-bone">
                      {route}
                    </div>
                    <div className="mt-1 font-mono text-[10px] tracking-[0.04em] text-bone-2">
                      {t.missionType.replace(/_/g, " ")} · {t.paxCount} pax
                    </div>
                  </div>
                  <span
                    className={[
                      "inline-block rounded-full border px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]",
                      STATUS_CLASS[t.status] ?? "border-ink-3 text-bone-2",
                    ].join(" ")}
                  >
                    {t.status.replace(/_/g, " ")}
                  </span>
                  <div className="text-right">
                    <div className="font-mono text-[12px] tracking-[0.04em] text-bone">
                      {t.revenueUsd ? formatUSD(t.revenueUsd) : "—"}
                    </div>
                    <div className="mt-1 font-mono text-[10px] tracking-[0.04em] text-bone-2">
                      {t.createdAt.toISOString().slice(0, 10)}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
