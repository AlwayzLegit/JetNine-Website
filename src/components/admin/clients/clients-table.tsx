"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { DeskEmpty } from "@/components/admin/desk-ui";

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

const COLS = "grid-cols-[minmax(0,1.5fr)_1.1fr_.8fr_1fr]";

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
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        {header}

        {rows.length === 0 ? (
          <DeskEmpty title={emptyTitle} body={emptyBody} className="mt-6" />
        ) : (
          <div className="card mt-6 overflow-hidden">
            <div
              className={`grid ${COLS} gap-4 border-b border-line px-6 py-3 text-[13px] font-semibold text-steel`}
              role="row"
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
                    `grid w-full ${COLS} items-center gap-4 border-b border-line-faint px-6 py-4 text-left text-[15px] text-bone transition-colors last:border-b-0`,
                    active ? "bg-surface-2" : "hover:bg-surface-2/50",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-clearance",
                  ].join(" ")}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[16px] font-medium">{c.name}</span>
                    <span className="block truncate text-[14px] text-steel">{c.email}</span>
                  </span>
                  <span>
                    {c.flights}
                    {c.flightNote ? <span className="block text-[14px] text-steel">{c.flightNote}</span> : null}
                  </span>
                  <span>{c.spent}</span>
                  <span className={c.isMember ? "text-bone" : "text-steel"}>
                    {c.member}
                    {c.memberNote ? <span className="block text-[14px] text-steel">{c.memberNote}</span> : null}
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
    <aside className="card p-6 lg:sticky lg:top-8" aria-label={`Preview of ${client.name}`}>
      <div className="text-[13px] font-semibold text-steel">Preview</div>
      <div className="mt-1.5 font-serif text-[28px] font-light leading-[1.1] text-bone">{client.name}</div>
      <div className="mt-0.5 break-words text-[14px] text-steel">{contact}</div>

      <div className="mt-3.5 grid grid-cols-3 gap-2">
        <ContactLink href={client.phone ? `tel:${client.phone}` : null}>Call</ContactLink>
        <ContactLink href={client.phone ? `sms:${client.phone}` : null}>Text</ContactLink>
        <ContactLink href={client.email ? `mailto:${client.email}` : null}>Email</ContactLink>
      </div>

      <dl className="mt-5 flex flex-col gap-3.5 text-[15px] leading-[1.45]">
        <div className="border-t border-line pt-3">
          <dt className="text-[13px] text-steel">Next flight</dt>
          <dd className="mt-0.5 text-bone">{client.nextFlight}</dd>
        </div>
        <div className="border-t border-line pt-3">
          <dt className="text-[13px] text-steel">Good to know</dt>
          <dd className={`mt-0.5 ${client.notes ? "text-bone-2" : "text-steel"}`}>
            {client.notes ?? "Nothing on file yet."}
          </dd>
        </div>
        <div className="border-t border-line pt-3">
          <dt className="text-[13px] text-steel">Membership</dt>
          <dd className="mt-0.5 text-bone">{client.membership}</dd>
        </div>
      </dl>

      <Link href={`/admin/clients/${client.id}`} className="btn btn-primary mt-5 w-full">
        Open full client page
      </Link>
    </aside>
  );
}

function ContactLink({ href, children }: { href: string | null; children: ReactNode }) {
  const cls = "btn btn-secondary btn-sm w-full px-0";
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
