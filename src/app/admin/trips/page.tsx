import { asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { trips, tripLegs } from "@/db/schema/trips";
import { members } from "@/db/schema/members";
import { users } from "@/db/schema/users";
import { aircraft } from "@/db/schema/aircraft";
import { operators } from "@/db/schema/operators";
import { quotes } from "@/db/schema/quotes";
import { invoices } from "@/db/schema/invoices";
import { sourcedOptions } from "@/db/schema/sourced-option";
import { formatUSD } from "@/lib/quote-pricing";
import { formatDay, formatLongDay } from "@/lib/request-page";
import { invoiceWords, passengersWords, personName, tripState } from "@/lib/desk-status";
import {
  DeskEmpty,
  DeskGroup,
  DeskHeader,
  DeskPage,
  DeskRow,
  DeskSearch,
  DeskTabs,
  DotSentence,
} from "@/components/admin/desk-ui";
import {
  aircraftLine,
  dayKey,
  groundWords,
  legArriveClock,
  legDayKey,
  legDepartClock,
  legRoute,
  missionWords,
  shiftDayKey,
  type LegLike,
} from "@/components/admin/trips/trip-words";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ tab?: string; q?: string }> };

type TabKey = "upcoming" | "past" | "all";

const TABS: { key: TabKey; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Flown" },
  { key: "all", label: "All" },
];

const AIRBORNE_STATUSES = new Set(["boarding", "airborne"]);

export default async function AdminTripsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const tab: TabKey = sp.tab === "past" || sp.tab === "all" ? sp.tab : "upcoming";
  const q = (sp.q ?? "").trim();
  const now = new Date();
  const today = dayKey(now);
  const in30 = shiftDayKey(today, 30);
  const ago90 = shiftDayKey(today, -90);

  const pat = q ? `%${q.replace(/[%_]/g, "\\$&")}%` : null;
  const where = pat
    ? or(
        ilike(users.firstName, pat),
        ilike(users.lastName, pat),
        ilike(users.email, pat),
        ilike(members.preferredName, pat),
        ilike(members.legalName, pat),
        sql`exists (select 1 from ${tripLegs} tl where tl.trip_id = ${trips.id} and (tl.from_city ilike ${pat} or tl.to_city ilike ${pat}))`,
      )
    : undefined;

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
      quoteId: trips.quoteId,
      memberCode: members.memberCode,
      preferredName: members.preferredName,
      legalName: members.legalName,
      memberEmail: users.email,
      memberPhone: users.phoneE164,
      memberFirstName: users.firstName,
      memberLastName: users.lastName,
      makeModel: aircraft.makeModel,
      tailNumber: aircraft.tailNumber,
      operatorName: operators.name,
      groundOption: quotes.groundOption,
    })
    .from(trips)
    .innerJoin(members, eq(members.id, trips.memberId))
    .innerJoin(users, eq(users.id, members.userId))
    .leftJoin(aircraft, eq(aircraft.id, trips.aircraftId))
    .leftJoin(operators, eq(operators.id, trips.operatorId))
    .leftJoin(quotes, eq(quotes.id, trips.quoteId))
    .where(where)
    .orderBy(desc(trips.createdAt))
    .limit(100);

  const ids = rows.map((r) => r.id);
  const quoteIds = rows.map((r) => r.quoteId).filter((x): x is string => Boolean(x));

  const [legs, invoiceRows, chosenOptions] = await Promise.all([
    ids.length
      ? db
          .select({
            tripId: tripLegs.tripId,
            legNumber: tripLegs.legNumber,
            fromIata: tripLegs.fromIata,
            fromCity: tripLegs.fromCity,
            fromName: tripLegs.fromName,
            toIata: tripLegs.toIata,
            toCity: tripLegs.toCity,
            toName: tripLegs.toName,
            departDate: tripLegs.departDate,
            departTime: tripLegs.departTime,
            departTz: tripLegs.departTz,
            scheduledDepAt: tripLegs.scheduledDepAt,
            scheduledArrAt: tripLegs.scheduledArrAt,
          })
          .from(tripLegs)
          .where(inArray(tripLegs.tripId, ids))
          .orderBy(asc(tripLegs.legNumber))
      : Promise.resolve([]),
    ids.length
      ? db
          .select({
            tripId: invoices.tripId,
            status: invoices.status,
            issuedOn: invoices.issuedOn,
            dueOn: invoices.dueOn,
            paidOn: invoices.paidOn,
            totalUsd: invoices.totalUsd,
            kind: invoices.kind,
          })
          .from(invoices)
          .where(inArray(invoices.tripId, ids))
          .orderBy(asc(invoices.createdAt))
      : Promise.resolve([]),
    quoteIds.length
      ? db
          .select({
            quoteId: sourcedOptions.quoteId,
            aircraftType: sourcedOptions.aircraftType,
            tailNumber: sourcedOptions.tailNumber,
            operatorNameRaw: sourcedOptions.operatorNameRaw,
          })
          .from(sourcedOptions)
          .where(inArray(sourcedOptions.quoteId, quoteIds))
          .orderBy(desc(sourcedOptions.isChosen), asc(sourcedOptions.optionNumber))
      : Promise.resolve([]),
  ]);

  const legsByTrip = new Map<string, LegLike[]>();
  for (const l of legs) {
    const arr = legsByTrip.get(l.tripId) ?? [];
    arr.push(l);
    legsByTrip.set(l.tripId, arr);
  }
  // The charter invoice drives the to-do line; credits/refunds are noise here.
  const invoiceByTrip = new Map<string, (typeof invoiceRows)[number]>();
  for (const inv of invoiceRows) {
    if (!inv.tripId) continue;
    const prev = invoiceByTrip.get(inv.tripId);
    if (!prev || (prev.kind !== "charter" && inv.kind === "charter")) invoiceByTrip.set(inv.tripId, inv);
  }
  const optionByQuote = new Map<string, (typeof chosenOptions)[number]>();
  for (const o of chosenOptions) if (!optionByQuote.has(o.quoteId)) optionByQuote.set(o.quoteId, o);

  // ── Shape each trip once ──
  const items = rows.map((t) => {
    const tripLegRows = legsByTrip.get(t.id) ?? [];
    const first = tripLegRows[0] ?? null;
    const last = tripLegRows[tripLegRows.length - 1] ?? null;
    const day = first ? legDayKey(first) : null;
    const state = tripState(t.status);
    const isPast = state.bucket === "past" || (day !== null && day < today && !AIRBORNE_STATUSES.has(t.status));
    const name = personName(
      t.memberFirstName,
      t.memberLastName,
      t.preferredName ?? t.legalName ?? t.memberEmail ?? "No name yet",
    );
    const option = t.quoteId ? optionByQuote.get(t.quoteId) : undefined;
    const craft = aircraftLine({
      makeModel: t.makeModel,
      tailNumber: t.tailNumber,
      operatorName: t.operatorName,
      optionType: option?.aircraftType,
      optionTail: option?.tailNumber,
      optionOperator: option?.operatorNameRaw,
    });
    const inv = invoiceByTrip.get(t.id);

    let todo = "Nothing to do";
    let action = "Open";
    if (inv) {
      const words = invoiceWords(inv.status, inv.dueOn, now);
      if (inv.status === "paid") {
        todo = inv.totalUsd ? `Paid · ${formatUSD(inv.totalUsd)}` : "Paid";
        if (isPast) action = "Receipt";
      } else if (inv.status === "due" || inv.status === "overdue") {
        const sent = formatDay(inv.issuedOn);
        todo = `${words.text}${sent ? ` · invoice sent ${sent}` : ""} · unpaid`;
        if (words.tone === "danger") action = "Send reminder";
      } else {
        todo = words.text;
      }
    }

    let route = first ? legRoute(first) : "Route to confirm";
    if (!isPast && first) {
      if (t.missionType === "round" && last && last !== first) {
        const back = formatDay(legDayKey(last));
        route += back ? ` · returns ${back}` : " · round trip";
      } else {
        route += ` · ${missionWords(t.missionType, tripLegRows.length)}`;
      }
    }

    const flyingToday =
      !isPast && (AIRBORNE_STATUSES.has(t.status) || (day !== null && day === today));

    return {
      id: t.id,
      status: t.status,
      state,
      isPast,
      day,
      name,
      firstName: t.memberFirstName?.trim() || null,
      phone: t.memberPhone,
      pax: t.paxCount,
      route,
      craft,
      todo,
      action,
      first,
      flyingToday,
      ground: groundWords(t.groundOption),
      sortKey: `${day ?? "9999-99-99"} ${first ? legDepartClock(first) ?? "" : ""}`,
    };
  });

  const upcoming = items.filter((i) => !i.isPast).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const past = items.filter((i) => i.isPast).sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  const groups: { key: string; title: string; rows: typeof items }[] = [];
  if (tab !== "past") {
    groups.push(
      { key: "soon", title: "Next 30 days", rows: upcoming.filter((i) => i.day === null || i.day <= in30) },
      { key: "later", title: "Later", rows: upcoming.filter((i) => i.day !== null && i.day > in30) },
    );
  }
  if (tab !== "upcoming") {
    groups.push(
      { key: "recent", title: "Flown · last 90 days", rows: past.filter((i) => i.day === null || i.day >= ago90) },
      { key: "earlier", title: "Earlier", rows: past.filter((i) => i.day !== null && i.day < ago90) },
    );
  }
  const visibleGroups = groups.filter((g) => g.rows.length > 0);
  const todayTrips = tab === "past" ? [] : upcoming.filter((i) => i.flyingToday);

  return (
    <DeskPage>
      <DeskHeader
        title="Trips"
        lead="Booked flights. Requests become trips the moment a client confirms."
        actions={<DeskSearch defaultValue={q} hidden={{ tab: sp.tab }} />}
      />

      <DeskTabs
        className="mt-6"
        base="/admin/trips"
        current={tab}
        keep={{ q }}
        items={TABS.map((t) => ({
          key: t.key,
          label: t.label,
          count: t.key === "upcoming" ? upcoming.length : t.key === "past" ? past.length : undefined,
        }))}
      />

      {todayTrips.length > 0 ? (
        <section className="mt-8">
          <h2 className="label-jn mb-2.5 text-[13px]">Flying today · {formatLongDay(today)}</h2>
          <div className="flex flex-col gap-4">
            {todayTrips.map((t) => {
              const dep = t.first ? legDepartClock(t.first) : null;
              const arr = t.first ? legArriveClock(t.first) : null;
              const departed = t.status === "airborne" || t.status === "wheels_down";
              const line = [
                t.first ? legRoute(t.first) : "Route to confirm",
                dep ? `${departed ? "departed" : "departs"} ${dep}` : null,
                arr ? `lands about ${arr}` : null,
              ]
                .filter(Boolean)
                .join(" · ");
              const textHref = t.phone ? `sms:${t.phone}` : `/admin/trips/${t.id}#conversation`;
              return (
                <article
                  key={t.id}
                  className="card card-highlight grid grid-cols-1 gap-6 p-6 md:px-7 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-8"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-[20px] font-medium text-bone">{t.name}</span>
                      <span className="text-steel">· {passengersWords(t.pax)}</span>
                      <span className="pill pill-outline h-[26px]">
                        <DotSentence tone={t.state.dot}>{t.state.label}</DotSentence>
                      </span>
                    </div>
                    <p className="mt-1 text-[17px] text-bone">{line}</p>
                    <dl className="dl-jn mt-3.5 text-[14px]">
                      <dt>Aircraft</dt>
                      <dd className="text-bone-2">{t.craft ?? "Aircraft to confirm"}</dd>
                      {t.ground ? (
                        <>
                          <dt>On arrival</dt>
                          <dd className="text-bone-2">{t.ground}</dd>
                        </>
                      ) : null}
                    </dl>
                  </div>
                  <div className="flex flex-col justify-center gap-2">
                    <a href={textHref} className="btn btn-primary">
                      Text {t.firstName ?? "the client"} an update
                    </a>
                    <a href={`/admin/trips/${t.id}`} className="btn btn-secondary">
                      Open trip
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {items.length === 0 ? (
        <DeskEmpty
          title={q ? "No trips match that search." : "No trips yet."}
          body={
            q
              ? "Try a client name, an email or a city."
              : "Confirm a booking from a request and it shows up here."
          }
        />
      ) : visibleGroups.length === 0 ? (
        <DeskEmpty
          title={tab === "past" ? "Nothing flown yet." : "Nothing coming up."}
          body={
            tab === "past"
              ? "Trips land here once they have flown."
              : "Confirm a booking from a request and it shows up here."
          }
        />
      ) : (
        visibleGroups.map((g) => (
          <DeskGroup key={g.key} title={g.title} count={g.rows.length}>
            {g.rows.map((t) => {
              const dayWords = formatDay(t.day);
              const clock = t.first ? legDepartClock(t.first) : null;
              return (
                <DeskRow
                  key={t.id}
                  href={`/admin/trips/${t.id}${t.action === "Receipt" ? "#money" : ""}`}
                  cols="md:grid-cols-[120px_minmax(0,1fr)_260px_auto]"
                >
                  <div>
                    <div className="text-[17px] font-medium text-bone">{dayWords ?? "Date to confirm"}</div>
                    <div className="text-[14px] text-steel">{clock ?? "Time to confirm"}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[17px] font-medium text-bone">
                      {t.name} <span className="font-normal text-steel">· {passengersWords(t.pax)}</span>
                    </div>
                    <div className="mt-0.5 text-bone-2">{t.route}</div>
                    {t.craft ? <div className="mt-0.5 text-[14px] text-steel">{t.craft}</div> : null}
                  </div>
                  <div className="text-[14px] leading-[1.45]">
                    <DotSentence tone={t.state.dot} className="text-bone">
                      {t.state.label}
                    </DotSentence>
                    <div className="text-bone-2">{t.todo}</div>
                  </div>
                  <span className="btn btn-secondary btn-sm justify-self-start md:justify-self-end">{t.action}</span>
                </DeskRow>
              );
            })}
          </DeskGroup>
        ))
      )}
    </DeskPage>
  );
}
