import { formatLongDay } from "@/lib/request-page";
import { passengersWords } from "@/lib/desk-status";
import {
  DeskEmpty,
  DeskGroup,
  DeskHeader,
  DeskPage,
  DeskRow,
  DeskSearch,
  DeskTabs,
  DeskOverline,
  DotSentence,
} from "@/components/admin/desk-ui";
import { legArriveClock, legDepartClock, legRoute } from "@/components/admin/trips/trip-words";
import { TRIP_TABS, listTrips } from "@/domain/trips/queries";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ tab?: string; q?: string }> };

export default async function AdminTripsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const {
    tab,
    q,
    today,
    items,
    groups: visibleGroups,
    flyingToday: todayTrips,
    counts,
  } = await listTrips({ tab: sp.tab, q: sp.q, now: new Date() });

  return (
    <DeskPage>
      <DeskHeader
        title="Trips"
        lead={[
          `${counts.upcoming} upcoming`,
          todayTrips.length ? `${todayTrips.length} flying today` : null,
          `${counts.past} flown`,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <DeskSearch
            placeholder="Search client, city or aircraft"
            width={260}
            defaultValue={q}
            hidden={{ tab: sp.tab }}
          />
        }
      />

      <DeskTabs
        className="mt-4"
        base="/admin/trips"
        current={tab}
        keep={{ q }}
        items={TRIP_TABS.map((t) => ({
          key: t.key,
          label: t.label,
          count: t.key === "upcoming" ? counts.upcoming : t.key === "past" ? counts.past : undefined,
        }))}
      />

      {todayTrips.length > 0 ? (
        <section className="mt-[22px]">
          <DeskOverline as="h2" className="mb-2">
            Flying today · {formatLongDay(today)}
          </DeskOverline>
          <div className="flex flex-col gap-2.5">
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
                  className="grid grid-cols-1 gap-5 border border-gold bg-panel p-4 md:px-[18px] lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-8"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-serif text-[21px] leading-[1.15] text-bone">{t.name}</span>
                      <span className="text-[14px] text-steel">· {passengersWords(t.pax)}</span>
                      <span className="pill pill-outline h-[26px] bg-surface">
                        <DotSentence tone={t.state.dot}>{t.state.label}</DotSentence>
                      </span>
                    </div>
                    <p className="mt-1 text-[15px] text-bone">{line}</p>
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
                    <a href={textHref} className="btn btn-primary btn-sm text-[13px] font-bold">
                      Text {t.firstName ?? "the client"} an update
                    </a>
                    <a href={`/admin/trips/${t.id}`} className="btn btn-secondary btn-sm bg-surface text-[13px]">
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
          <DeskGroup key={g.key} title={g.title} count={g.items.length} stack className="mt-[22px]">
            {g.items.map((t) => {
              const parts = dayParts(t.day);
              const clock = t.first ? legDepartClock(t.first) : null;
              const hot = !t.isPast && (t.state.dot === "gold" || t.state.dot === "danger" || t.action !== "Open");
              return (
                <DeskRow
                  key={t.id}
                  card
                  hot={hot}
                  href={`/admin/trips/${t.id}${t.action === "Receipt" ? "#money" : ""}`}
                  cols="grid-cols-[72px_minmax(0,1fr)] md:grid-cols-[92px_minmax(0,1fr)_230px_auto] md:!gap-[18px]"
                  className="!items-start md:!items-center"
                >
                  <div className="row-span-2 border-r border-line pr-3.5 text-center md:row-span-1">
                    {parts ? (
                      <>
                        <div className="text-[12px] text-steel">{parts.dow}</div>
                        <div className="font-serif text-[28px] leading-none text-bone">{parts.day}</div>
                        <div className="text-[12px] text-steel">{parts.month}</div>
                      </>
                    ) : (
                      <div className="text-[12px] text-steel">Date to confirm</div>
                    )}
                    {clock ? <div className="mt-1 text-[12px] text-steel">{clock}</div> : null}
                  </div>
                  <div className="min-w-0">
                    <div className="font-serif text-[21px] leading-[1.15] text-bone">
                      {t.name} <span className="font-sans text-[14px] text-steel">· {passengersWords(t.pax)}</span>
                    </div>
                    <div className="mt-0.5 text-[14px] text-bone">{t.route}</div>
                    {t.craft ? <div className="mt-0.5 text-[13px] text-steel">{t.craft}</div> : null}
                  </div>
                  <div className="min-w-0 text-[13px] leading-[1.45]">
                    <DotSentence tone={t.state.dot} className="font-bold text-bone">
                      {t.state.label}
                    </DotSentence>
                    <div className="mt-1 text-steel">{t.todo}</div>
                  </div>
                  <span
                    className={`col-span-2 inline-flex h-11 items-center justify-center rounded-control border border-clearance px-3.5 text-[13px] font-bold md:col-span-1 md:h-9 ${
                      hot ? "bg-clearance text-white" : "bg-surface text-bone"
                    }`}
                  >
                    {t.action}
                  </span>
                </DeskRow>
              );
            })}
          </DeskGroup>
        ))
      )}

      <p className="mt-[18px] text-[12px] text-steel">
        Booked flights. Requests become trips the moment a client confirms; this is the client-side view of what each
        client has been told and what still needs doing.
      </p>
    </DeskPage>
  );
}

/** "2026-10-08" → { dow: "Thu", day: "8", month: "Oct" } for the date block. */
function dayParts(day: string | null): { dow: string; day: string; month: string } | null {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const d = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...o }).format(d);
  return { dow: f({ weekday: "short" }), day: f({ day: "numeric" }), month: f({ month: "short" }) };
}
