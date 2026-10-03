import { formatDay, formatLongDay } from "@/lib/request-page";
import { passengersWords } from "@/lib/desk-status";
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
        lead="Booked flights. Requests become trips the moment a client confirms."
        actions={<DeskSearch defaultValue={q} hidden={{ tab: sp.tab }} />}
      />

      <DeskTabs
        className="mt-6"
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
          <DeskGroup key={g.key} title={g.title} count={g.items.length}>
            {g.items.map((t) => {
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
