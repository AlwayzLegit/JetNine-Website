"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { DESK_MINI_BTN, DESK_PANEL, DeskEmpty, DeskOverline } from "@/components/admin/desk-ui";

/** One client as the list page serialises it — words only, no Dates. */
export type ClientRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  /** "3 flights" */
  flights: string;
  /** "next: Oct 3" · "last: Feb 20" · "request open" · "flying today" */
  flightNote: string | null;
  /** "$44,300" or "—" */
  spent: string;
  /** "JetNine Card · 100 hours" or "None" */
  member: string;
  /** "$18,400 left" · "since Mar 2024" */
  memberNote: string | null;
  isMember: boolean;
  /** Preview: "Los Angeles → Aspen · Fri, Oct 3 · 4 passengers" */
  nextFlight: string;
  /** Preview: the preferences line, or null. */
  notes: string | null;
  /** Preview: "JetNine Card · 100 hours · since Mar 2024" */
  membership: string;
};

const COLS = "grid-cols-2 md:grid-cols-[minmax(0,1.5fr)_1.1fr_.8fr_1.1fr]";

/**
 * The Clients table and its preview drawer. The server page renders the
 * header, tabs and invite panel and passes them as `header`; this component
 * owns only the selected row, so the first client is already selected on
 * the server render and nothing flashes.
 */
export function ClientsTable({
  rows,
  header,
  emptyTitle = "No one matches.",
  emptyBody = "Try another name, or clear the search.",
}: {
  rows: ClientRow[];
  header: ReactNode;
  emptyTitle?: string;
  emptyBody?: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(rows[0]?.id ?? null);
  const selected = rows.find((r) => r.id === selectedId) ?? rows[0] ?? null;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        {header}

        {rows.length === 0 ? (
          <DeskEmpty title={emptyTitle} body={emptyBody} className="mt-4" />
        ) : (
          <div className={`${DESK_PANEL} mt-4 overflow-hidden text-[14px]`}>
            <div
              className={`hidden ${COLS} gap-3 bg-surface-2 px-4 py-2.5 text-[12px] font-bold text-bone md:grid`}
              aria-hidden="true"
            >
              <span>Name</span>
              <span>Flights</span>
              <span>Total spent</span>
              <span>Membership</span>
            </div>
            {rows.map((c) => {
              const active = selected?.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedId(c.id)}
                  className={[
                    `grid w-full ${COLS} items-start gap-x-3 gap-y-1.5 border-t border-line px-4 py-3 text-left text-[14px] text-bone transition-colors md:items-center`,
                    active ? "bg-surface-2" : "hover:bg-surface-2/40",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-clearance",
                  ].join(" ")}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{c.name}</span>
                    <span className="block truncate text-[12px] text-steel">{c.email}</span>
                  </span>
                  <span>
                    {c.flights}
                    {c.flightNote ? <span className="block text-[12px] text-steel">{c.flightNote}</span> : null}
                  </span>
                  <span>{c.spent}</span>
                  <span className={c.isMember ? "text-bone" : "text-steel"}>
                    {c.member}
                    {c.memberNote ? <span className="block text-[12px] text-steel">{c.memberNote}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selected ? <Preview client={selected} /> : null}
    </div>
  );
}

function Preview({ client }: { client: ClientRow }) {
  const contact = [client.email, client.phone].filter(Boolean).join(" · ");
  return (
    <aside
      className={`${DESK_PANEL} px-5 py-[18px] text-[14px] leading-[1.5] lg:sticky lg:top-5`}
      aria-label={`Preview of ${client.name}`}
    >
      <DeskOverline>Preview</DeskOverline>
      <div className="mt-1.5 font-serif text-[24px] leading-[1.1] text-bone">{client.name}</div>
      <div className="mt-0.5 break-words text-[13px] text-steel">{contact}</div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <ContactLink href={client.phone ? `tel:${client.phone}` : null}>Call</ContactLink>
        <ContactLink href={client.phone ? `sms:${client.phone}` : null}>Text</ContactLink>
        <ContactLink href={client.email ? `mailto:${client.email}` : null}>Email</ContactLink>
      </div>

      <dl className="mt-3 flex flex-col gap-2.5">
        <div className="border-t border-line pt-2.5">
          <dt className="font-bold text-bone">Next flight</dt>
          <dd className="text-bone">{client.nextFlight}</dd>
        </div>
        <div className="border-t border-line pt-2.5">
          <dt className="font-bold text-bone">Good to know</dt>
          <dd className={client.notes ? "text-bone" : "text-steel"}>
            {client.notes ?? "Nothing on file yet."}
          </dd>
        </div>
        <div className="border-t border-line pt-2.5">
          <dt className="font-bold text-bone">Membership</dt>
          <dd className="text-bone">{client.membership}</dd>
        </div>
      </dl>

      <Link
        href={`/admin/clients/${client.id}`}
        className="mt-3.5 flex h-11 items-center justify-center rounded-control border border-clearance bg-surface text-[13px] text-bone transition-colors hover:bg-surface-2 md:h-[38px]"
      >
        Open full client page
      </Link>
    </aside>
  );
}

function ContactLink({ href, children }: { href: string | null; children: ReactNode }) {
  const cls = `${DESK_MINI_BTN} ${href ? "" : "pointer-events-none opacity-40"}`;
  if (!href) {
    return (
      <span className={cls} aria-disabled="true">
        {children}
      </span>
    );
  }
  return (
    <a href={href} className={cls}>
      {children}
    </a>
  );
}
