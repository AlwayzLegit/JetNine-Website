import { and, asc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { members } from "@/db/schema/members";
import { users } from "@/db/schema/users";
import { memberships } from "@/db/schema/memberships";
import { memberPreferences } from "@/db/schema/member-prefs";
import { trips, tripLegs } from "@/db/schema/trips";
import { formatUSD } from "@/lib/quote-pricing";
import { formatDay } from "@/lib/request-page";
import { isCardOrReserve, passengersWords, personName, tierWords } from "@/lib/desk-status";
import { DeskEmpty, DeskHeader, DeskPage, DeskSearch, DeskTabs } from "@/components/admin/desk-ui";
import { MemberInviteForm } from "@/components/admin/member-invite-form";
import { ClientsTable, type ClientRow } from "@/components/admin/clients/clients-table";
import {
  flightsWords,
  isReserveProgram,
  monthYear,
  prefsLine,
  routeFromLegs,
  shortDay,
} from "@/components/admin/clients/client-words";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string; tab?: string }> };

const TABS = [
  { key: "all", label: "All" },
  { key: "recent", label: "Flew recently" },
  { key: "card", label: "Card members" },
  { key: "new", label: "New" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export default async function AdminClientsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const tab: TabKey = TABS.some((t) => t.key === sp.tab) ? (sp.tab as TabKey) : "all";

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const recentCutoff = new Date(now.getTime() - 90 * 86_400_000).toISOString().slice(0, 10);

  // One join: profile + active membership + preferences, with the per-client
  // aggregates the table and the preview need (trip count, lifetime revenue,
  // last flown date, next trip, open requests, reserve balance).
  const like = `%${q}%`;
  const rows = await db
    .select({
      id: members.id,
      tier: members.tier,
      status: members.status,
      memberSince: members.memberSince,
      tierSince: members.tierSince,
      mobileE164: members.mobileE164,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phoneE164: users.phoneE164,
      tripCount: sql<number>`(
        select count(*)::int from public.trips t where t.member_id = ${members.id}
      )`,
      lifetimeUsd: sql<number>`(
        select coalesce(sum(i.total_usd), 0)::int from public.invoices i
        where i.member_id = ${members.id} and i.status in ('paid','due','overdue')
      )`,
      lastFlownOn: sql<string | null>`(
        select max(l.depart_date)::text from public.trip_legs l
        join public.trips t on t.id = l.trip_id
        where t.member_id = ${members.id}
          and l.depart_date < ${today}::date
          and t.status not in ('draft','cancelled_wx','cancelled_other')
      )`,
      nextTripId: sql<string | null>`(
        select t.id::text from public.trips t
        join public.trip_legs l on l.trip_id = t.id
        where t.member_id = ${members.id}
          and l.depart_date >= ${today}::date
          and t.status not in ('wheels_down','completed','cancelled_wx','cancelled_other')
        order by l.depart_date asc limit 1
      )`,
      openRequests: sql<number>`(
        select count(*)::int from public.quotes q
        where q.member_id = ${members.id}
          and q.status in ('submitted','triaged','sourcing','options_sent','held')
      )`,
      reserveUsd: sql<number>`(
        select coalesce(sum(r.amount_usd), 0)::int from public.reserve_transactions r
        where r.member_id = ${members.id}
      )`,
      program: memberships.program,
      programSince: memberships.activatedOn,
      programRenews: memberships.nextRenewalDate,
      programEnds: memberships.expiresOn,
      prefs: memberPreferences,
    })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .leftJoin(memberships, and(eq(memberships.memberId, members.id), eq(memberships.status, "active")))
    .leftJoin(memberPreferences, eq(memberPreferences.memberId, members.id))
    .where(
      q
        ? or(
            ilike(users.firstName, like),
            ilike(users.lastName, like),
            ilike(users.email, like),
            ilike(members.legalName, like),
            ilike(members.preferredName, like),
            ilike(members.companyName, like),
          )
        : undefined,
    )
    .orderBy(asc(users.lastName), asc(users.firstName))
    .limit(200);

  // The next trip for everyone who has one: passengers + legs for the route.
  const nextIds = rows.flatMap((r) => (r.nextTripId ? [r.nextTripId] : []));
  const [nextTrips, nextLegs] = nextIds.length
    ? await Promise.all([
        db
          .select({ id: trips.id, paxCount: trips.paxCount, status: trips.status })
          .from(trips)
          .where(inArray(trips.id, nextIds)),
        db
          .select({
            tripId: tripLegs.tripId,
            fromIata: tripLegs.fromIata,
            fromCity: tripLegs.fromCity,
            fromName: tripLegs.fromName,
            toIata: tripLegs.toIata,
            toCity: tripLegs.toCity,
            toName: tripLegs.toName,
            departDate: tripLegs.departDate,
          })
          .from(tripLegs)
          .where(inArray(tripLegs.tripId, nextIds))
          .orderBy(asc(tripLegs.legNumber)),
      ])
    : [[], []];
  const nextById = new Map(nextTrips.map((t) => [t.id, t]));
  const nextLegsById = new Map<string, typeof nextLegs>();
  for (const l of nextLegs) nextLegsById.set(l.tripId, [...(nextLegsById.get(l.tripId) ?? []), l]);

  const clients = rows.map((r) => {
    const program = r.program ?? r.tier;
    const isMember = isCardOrReserve(program);
    const reserve = isReserveProgram(program);
    const legs = r.nextTripId ? (nextLegsById.get(r.nextTripId) ?? []) : [];
    const nextLeg = legs.find((l) => l.departDate != null && l.departDate >= today) ?? legs[0] ?? null;
    const nextTrip = r.nextTripId ? nextById.get(r.nextTripId) : null;
    const nextDate = nextLeg?.departDate ?? null;
    const flewRecently = Boolean(r.lastFlownOn && r.lastFlownOn >= recentCutoff) || nextDate === today;

    const flightNote = nextTrip
      ? nextDate === today
        ? "flying today"
        : nextDate
          ? `next: ${shortDay(nextDate, now)}`
          : "next trip being set up"
      : r.openRequests > 0
        ? "request open"
        : r.lastFlownOn
          ? `last: ${shortDay(r.lastFlownOn, now)}`
          : null;

    const since = monthYear(r.programSince ?? r.tierSince);
    const memberNote = !isMember
      ? null
      : reserve
        ? `${formatUSD(r.reserveUsd)} left`
        : since
          ? `since ${since}`
          : null;

    const renews = monthYear(r.programRenews);
    const ends = monthYear(r.programEnds);
    const membership = isMember
      ? [
          tierWords(program),
          reserve ? `${formatUSD(r.reserveUsd)} left` : null,
          renews ? `renews ${renews}` : ends ? `until ${ends}` : since ? `since ${since}` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : "No membership";

    const nextFlight = nextTrip
      ? [
          routeFromLegs(legs) ?? "Route being set up",
          nextDate === today ? "today" : formatDay(nextDate),
          passengersWords(nextTrip.paxCount),
        ]
          .filter(Boolean)
          .join(" · ")
      : r.openRequests > 0
        ? `Nothing booked · ${plural(r.openRequests, "request")} open`
        : "Nothing booked";

    const row: ClientRow = {
      id: r.id,
      name: personName(r.firstName, r.lastName, r.email),
      email: r.email,
      phone: r.mobileE164 ?? r.phoneE164 ?? null,
      flights: flightsWords(r.tripCount),
      flightNote,
      spent: r.lifetimeUsd ? formatUSD(r.lifetimeUsd) : "—",
      member: isMember ? tierWords(program) : "None",
      memberNote,
      isMember,
      nextFlight,
      notes: prefsLine(r.prefs),
      membership,
    };
    return { row, flewRecently, isMember, isNew: r.tripCount === 0 };
  });

  const counts: Record<TabKey, number> = {
    all: clients.length,
    recent: clients.filter((c) => c.flewRecently).length,
    card: clients.filter((c) => c.isMember).length,
    new: clients.filter((c) => c.isNew).length,
  };
  const visible = clients
    .filter((c) =>
      tab === "recent" ? c.flewRecently : tab === "card" ? c.isMember : tab === "new" ? c.isNew : true,
    )
    .map((c) => c.row);

  const lead = [
    plural(counts.all, "client"),
    `${counts.recent} flew in the last 90 days`,
    `${counts.card} hold${counts.card === 1 ? "s" : ""} a JetNine Card or Reserve`,
  ].join(" · ");

  const header = (
    <>
      <DeskHeader
        title="Clients"
        lead={lead}
        actions={
          <>
            <DeskSearch
              width={220}
              placeholder="Search a name or email"
              defaultValue={q}
              action="/admin/clients"
              hidden={{ tab: tab === "all" ? undefined : tab }}
            />
            <MemberInviteForm />
          </>
        }
      />
      <DeskTabs
        className="mt-6"
        base="/admin/clients"
        current={tab}
        keep={{ q: q || undefined }}
        items={TABS.map((t) => ({ key: t.key, label: t.label, count: counts[t.key] }))}
      />
    </>
  );

  // No clients at all (and no search narrowing things): the empty desk.
  if (rows.length === 0 && !q) {
    return (
      <DeskPage>
        <DeskHeader title="Clients" lead="0 clients" actions={<MemberInviteForm />} />
        <DeskEmpty title="No clients yet." body="Invite the first one, or they appear when someone books." />
      </DeskPage>
    );
  }

  return (
    <DeskPage>
      <ClientsTable
        rows={visible}
        header={header}
        emptyTitle={q ? "No one matches." : "Nobody here yet."}
        emptyBody={q ? "Try another name or email, or clear the search." : "Clients land in this tab as they fly."}
      />
    </DeskPage>
  );
}
