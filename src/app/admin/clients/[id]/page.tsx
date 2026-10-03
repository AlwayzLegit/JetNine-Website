import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { formatUSD } from "@/lib/quote-pricing";
import { formatDay, relativeTime } from "@/lib/request-format";
import { passengersWords, tierWords } from "@/lib/desk-status";
import { ContactButtons, DeskCard, DeskHeader, DeskPage, DotSentence, StatusPill } from "@/components/admin/desk-ui";
import { ReserveTxForm } from "@/components/admin/reserve-tx-form";
import {
  ACCOUNT_STATUS_WORDS,
  DOC_WORDS,
  RELATION_WORDS,
  ledgerKindWords,
  monthYear,
  shortDay,
  shortStamp,
} from "@/components/admin/clients/client-words";
import { getClient } from "@/domain/clients/queries";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const INVOICE_KIND_WORDS: Record<string, string> = {
  charter: "Charter",
  credit: "Credit",
  refund: "Refund",
  top_up: "Deposit",
  renewal: "Renewal",
};

export default async function AdminClientPage({ params }: Props) {
  const { id } = await params;
  const now = new Date();

  const client = await getClient(id, now);
  if (!client) notFound();
  const {
    member,
    words,
    dispatcher,
    prefs,
    prefBlocks,
    lanes,
    companions,
    documents,
    activeProgram,
    balance,
    trips,
    upcoming,
    requests,
    hasOpenRequest,
    invoices,
    lifetimeInvoiced,
    ledger,
  } = client;
  const { displayName, lead, memberSince, program, isMember, isReserve: reserve } = words;
  const phone = member.phone;

  return (
    <DeskPage>
      <DeskHeader
        back={{ href: "/admin/clients", label: "All clients" }}
        title={displayName}
        lead={
          <>
            {lead}
            <span className="mt-1 block text-[13px] text-steel">
              Reference {member.memberCode}
              {member.companyName
                ? ` · ${member.companyName}${member.roleTitle ? `, ${member.roleTitle}` : ""}`
                : null}
            </span>
          </>
        }
        actions={
          <>
            {member.status !== "active" ? (
              <StatusPill tone={member.status === "closed" ? "danger" : "steel"}>
                Account {ACCOUNT_STATUS_WORDS[member.status]?.toLowerCase() ?? member.status}
              </StatusPill>
            ) : null}
            <ContactButtons phone={phone} email={member.email} size="md" />
          </>
        }
      />

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ── Left column ─────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-4">
          <DeskCard title="Upcoming">
            {upcoming ? (
              <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="title-card-sm text-bone">{upcoming.route ?? "Route being set up"}</div>
                  <p className="mt-1 text-[15px] text-bone-2">
                    {[
                      upcoming.isToday ? "Today" : upcoming.when,
                      passengersWords(upcoming.paxCount),
                      upcoming.aircraft,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <DotSentence tone={upcoming.state.dot} className="mt-2 text-[15px] text-bone">
                    {upcoming.state.label}
                  </DotSentence>
                </div>
                <Link href={`/admin/trips/${upcoming.id}`} className="btn btn-secondary btn-sm">
                  Open the trip
                </Link>
              </div>
            ) : (
              <p className="mt-3 text-[15px] text-steel">
                Nothing booked.
                {hasOpenRequest
                  ? " A request is open below."
                  : ""}
              </p>
            )}
          </DeskCard>

          <DeskCard
            title="Trips"
            actions={
              <Link href="/admin/trips" className="text-[14px] text-steel transition-colors hover:text-bone">
                All trips →
              </Link>
            }
          >
            {trips.length === 0 ? (
              <p className="mt-3 text-[15px] text-steel">No trips yet.</p>
            ) : (
              <ul className="mt-2">
                {trips.map((t) => {
                  const state = t.state;
                  return (
                    <ListRow key={t.id} href={`/admin/trips/${t.id}`}>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-bone">
                          {t.route ?? "Route being set up"}
                        </span>
                        <span className="block text-[14px] text-steel">
                          {[formatDay(t.departDate), passengersWords(t.paxCount)].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <DotSentence tone={state.dot} className="text-bone-2">
                        {state.label}
                      </DotSentence>
                      <span className="text-right text-bone">{t.revenueUsd ? formatUSD(t.revenueUsd) : "—"}</span>
                    </ListRow>
                  );
                })}
              </ul>
            )}
          </DeskCard>

          <DeskCard
            title="Requests"
            actions={
              <Link href="/admin/requests" className="text-[14px] text-steel transition-colors hover:text-bone">
                All requests →
              </Link>
            }
          >
            {requests.length === 0 ? (
              <p className="mt-3 text-[15px] text-steel">No requests yet.</p>
            ) : (
              <ul className="mt-2">
                {requests.map((q) => {
                  const stage = q.stage;
                  return (
                    <ListRow key={q.id} href={`/admin/requests/${q.id}`}>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-bone">
                          {q.route ?? "Route not set"}
                        </span>
                        <span className="block text-[14px] text-steel">
                          {[formatDay(q.departDate), passengersWords(q.paxCount)].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <DotSentence tone={stage.dot} className="text-bone-2">
                        {stage.label}
                      </DotSentence>
                      <span className="text-right text-[14px] text-steel">
                        {q.receivedAt ? `Received ${relativeTime(q.receivedAt, now).toLowerCase()}` : ""}
                      </span>
                    </ListRow>
                  );
                })}
              </ul>
            )}
          </DeskCard>

          <DeskCard title="Invoices">
            {invoices.length === 0 ? (
              <p className="mt-3 text-[15px] text-steel">Nothing invoiced yet.</p>
            ) : (
              <ul className="mt-2">
                {invoices.map((i) => {
                  const words = i.words;
                  const route = i.route;
                  return (
                    <ListRow key={i.id}>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-bone">
                          {[INVOICE_KIND_WORDS[i.kind] ?? i.kind, route].filter(Boolean).join(" · ")}
                        </span>
                        <span className="block text-[14px] text-steel">
                          Issued {shortDay(i.issuedOn, now)}
                          {i.dueOn && i.status === "due" ? ` · due ${shortDay(i.dueOn, now)}` : ""}
                        </span>
                      </span>
                      <DotSentence tone={words.tone} className="text-bone-2">
                        {words.text}
                      </DotSentence>
                      <span className="text-right text-bone">{i.totalUsd ? formatUSD(i.totalUsd) : "—"}</span>
                    </ListRow>
                  );
                })}
              </ul>
            )}
          </DeskCard>
        </div>

        {/* ── Right column ────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-4">
          <DeskCard
            title="Good to know"
            actions={
              prefs ? <span className="text-[13px] text-steel">Updated {shortStamp(prefs.updatedAt, now)}</span> : null
            }
          >
            {!prefs ? (
              <p className="mt-3 text-[15px] text-steel">Nothing on file yet. They can set preferences from their account.</p>
            ) : prefBlocks.length === 0 ? (
              <p className="mt-3 text-[15px] text-steel">Nothing beyond the usual defaults.</p>
            ) : (
              <div className="mt-3 flex flex-col gap-4">
                {prefBlocks.map((b) => (
                  <PrefBlock key={b.label} label={b.label}>
                    {b.chips ? (
                      <ChipList items={b.chips} />
                    ) : (
                      <p className="text-[15px] leading-[1.5] text-bone">{b.text}</p>
                    )}
                  </PrefBlock>
                ))}
              </div>
            )}
          </DeskCard>

          <DeskCard title="Who travels with them">
            {companions.length === 0 ? (
              <p className="mt-3 text-[15px] text-steel">Nobody added yet.</p>
            ) : (
              <ul className="mt-2 flex flex-col">
                {companions.map((c) => {
                  const facts = [
                    RELATION_WORDS[c.relation] ?? c.relation,
                    c.relation === "pet" ? c.speciesBreed : null,
                    c.relation === "pet" && c.weightLb ? `${c.weightLb} lb` : null,
                    c.apisComplete ? "travel details on file" : null,
                    c.ccOnItinerary ? "copied on itineraries" : null,
                  ].filter(Boolean);
                  return (
                    <li key={c.id} className="border-b border-line-faint py-3 last:border-b-0 last:pb-0">
                      <div className="text-[15px] font-medium text-bone">{c.legalName}</div>
                      <div className="text-[14px] text-steel">{facts.join(" · ")}</div>
                      {c.notes ? <div className="mt-0.5 text-[14px] text-bone-2">{c.notes}</div> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </DeskCard>

          <DeskCard title="Usual routes">
            {lanes.length === 0 ? (
              <p className="mt-3 text-[15px] text-steel">Nothing regular yet.</p>
            ) : (
              <ul className="mt-2 flex flex-col">
                {lanes.map((l) => {
                  const facts = [
                    l.frequencyPerYear ? `${l.frequencyPerYear} ${l.frequencyPerYear === 1 ? "time" : "times"} a year` : null,
                    l.seasonal ? "seasonal" : null,
                    l.lastFlownAt ? `last flown ${shortDay(l.lastFlownAt, now)}` : null,
                  ].filter(Boolean);
                  return (
                    <li key={l.id} className="border-b border-line-faint py-3 last:border-b-0 last:pb-0">
                      <div className="text-[15px] font-medium text-bone">
                        {l.fromCity} → {l.toCity}
                      </div>
                      {facts.length ? <div className="text-[14px] text-steel">{facts.join(" · ")}</div> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </DeskCard>

          <DeskCard title="Membership">
            <div className="mt-3">
              <div className={`text-[17px] font-medium ${isMember ? "text-bone" : "text-steel"}`}>{tierWords(program)}</div>
              {reserve || balance !== 0 ? (
                <>
                  <div className="mt-2 font-serif text-[32px] font-light leading-none text-bone">{formatUSD(balance)}</div>
                  <div className="mt-1 text-[14px] text-steel">left in the reserve</div>
                </>
              ) : !isMember ? (
                <p className="mt-1 text-[14px] text-steel">Pays per flight.</p>
              ) : null}
            </div>

            {activeProgram ? (
              <dl className="dl-jn mt-4 gap-y-2 border-t border-line pt-4">
                <dt>Call-out</dt>
                <dd>{activeProgram.calloutHours} hours</dd>
                <dt>Rates locked</dt>
                <dd>{activeProgram.rateLockMonths} months</dd>
                <dt>Cashback</dt>
                <dd>{Number(activeProgram.cashbackPct)}%</dd>
                <dt>Cardholders</dt>
                <dd>{activeProgram.namedCardholdersLimit === 99 ? "Unlimited" : activeProgram.namedCardholdersLimit}</dd>
                <dt>Since</dt>
                <dd>{monthYear(activeProgram.activatedOn) ?? "—"}</dd>
                {activeProgram.nextRenewalDate ? (
                  <>
                    <dt>Renews</dt>
                    <dd>
                      {monthYear(activeProgram.nextRenewalDate)}
                      {activeProgram.autoRenew ? " · automatically" : ""}
                    </dd>
                  </>
                ) : activeProgram.expiresOn ? (
                  <>
                    <dt>Ends</dt>
                    <dd>{monthYear(activeProgram.expiresOn)}</dd>
                  </>
                ) : null}
              </dl>
            ) : null}

            <div className="mt-5 border-t border-line pt-4">
              <h3 className="text-[13px] font-semibold text-steel">Reserve ledger</h3>
              {ledger.length === 0 ? (
                <p className="mt-2 text-[15px] text-steel">No entries yet.</p>
              ) : (
                <ul className="mt-1 flex flex-col">
                  {ledger.map((tx) => (
                    <li
                      key={tx.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 border-b border-line-faint py-2.5 last:border-b-0"
                    >
                      <span className="min-w-0">
                        <span className="block text-[15px] text-bone">
                          {shortStamp(tx.occurredAt, now)} · {ledgerKindWords(tx.kind)}
                        </span>
                        {tx.description ? (
                          <span className="block truncate text-[13px] text-steel">{tx.description}</span>
                        ) : null}
                      </span>
                      <span className={`text-[15px] ${tx.amountUsd >= 0 ? "text-success" : "text-bone"}`}>
                        {tx.amountUsd >= 0 ? "+" : "−"}
                        {formatUSD(Math.abs(tx.amountUsd))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <details className="mt-3">
                <summary className="btn btn-secondary btn-sm cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  Add a ledger entry
                </summary>
                <div className="mt-3 rounded-control border border-line bg-surface-2/40 p-4">
                  <ReserveTxForm memberId={member.id} />
                </div>
              </details>
            </div>
          </DeskCard>

          <DeskCard title="Account">
            <dl className="dl-jn mt-3 gap-y-2">
              <dt>Legal name</dt>
              <dd>{member.legalName ?? "—"}</dd>
              <dt>Goes by</dt>
              <dd>{member.preferredName ?? "—"}</dd>
              <dt>Company</dt>
              <dd>
                {member.companyName
                  ? `${member.companyName}${member.roleTitle ? ` · ${member.roleTitle}` : ""}`
                  : "—"}
              </dd>
              <dt>Dispatcher</dt>
              <dd className={dispatcher ? "" : "text-steel"}>{dispatcher?.displayName ?? "Not assigned"}</dd>
              <dt>Account</dt>
              <dd>{ACCOUNT_STATUS_WORDS[member.status] ?? member.status}</dd>
              <dt>Two-step sign-in</dt>
              <dd>{member.twoFactorEnabled ? "On" : "Off"}</dd>
              <dt>Marketing email</dt>
              <dd>{member.marketingOptIn ? "Yes" : "No"}</dd>
              <dt>Member since</dt>
              <dd>{memberSince ?? "—"}</dd>
              {member.tierSince ? (
                <>
                  <dt>Membership since</dt>
                  <dd>{monthYear(member.tierSince)}</dd>
                </>
              ) : null}
              <dt>Flown with us</dt>
              <dd>
                {member.lifetimeTripsCache} {member.lifetimeTripsCache === 1 ? "flight" : "flights"} ·{" "}
                {member.lifetimeHoursCache} hours
              </dd>
              <dt>Billed to date</dt>
              <dd>{formatUSD(lifetimeInvoiced)}</dd>
            </dl>
          </DeskCard>

          {documents.length > 0 ? (
            <DeskCard title="Documents">
              <ul className="mt-2 flex flex-col">
                {documents.map((d) => {
                  const expires = monthYear(d.expiresOn);
                  const facts = [
                    d.countryIso2 ?? null,
                    expires ? `expires ${expires}` : null,
                    d.isPrimary ? "primary" : null,
                  ].filter(Boolean);
                  return (
                    <li key={d.id} className="border-b border-line-faint py-3 last:border-b-0 last:pb-0">
                      <div className="text-[15px] font-medium text-bone">{DOC_WORDS[d.docType] ?? d.docType}</div>
                      {facts.length ? <div className="text-[14px] text-steel">{facts.join(" · ")}</div> : null}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-[13px] text-steel">Numbers stay encrypted; only the type and expiry show here.</p>
            </DeskCard>
          ) : null}
        </div>
      </div>
    </DeskPage>
  );
}

/** Route · state · amount row inside a DeskCard; the whole row is the link. */
function ListRow({ href, children }: { href?: string; children: ReactNode }) {
  const cls = "grid grid-cols-1 items-center gap-x-6 gap-y-1 py-3.5 text-[15px] md:grid-cols-[minmax(0,1fr)_200px_110px]";
  return (
    <li className="border-b border-line-faint last:border-b-0">
      {href ? (
        <Link href={href} className={`${cls} -mx-2 rounded-control px-2 transition-colors hover:bg-surface-2/50`}>
          {children}
        </Link>
      ) : (
        <div className={cls}>{children}</div>
      )}
    </li>
  );
}

function PrefBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[13px] text-steel">{label}</div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function ChipList({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="text-[15px] text-steel">None</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => (
        <span key={it} className="chip chip-sm cursor-default">
          {it}
        </span>
      ))}
    </div>
  );
}
