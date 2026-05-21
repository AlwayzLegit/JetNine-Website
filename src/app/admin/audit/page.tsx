import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLog } from "@/db/schema/audit";
import { users } from "@/db/schema/users";

export const dynamic = "force-dynamic";

// Map subject_type → href builder. system + user_role + preferences + reserve
// have no detail page in v1 so they're rendered as plain text.
const SUBJECT_HREF: Partial<Record<string, (id: string) => string>> = {
  quote: (id) => `/admin/quote/${id}`,
  trip: (id) => `/admin/trip/${id}`,
  member: (id) => `/admin/member/${id}`,
  operator: (id) => `/admin/operators/${id}`,
  empty_leg: () => `/admin/empty-leg`,
};

const SUBJECT_CLASS: Record<string, string> = {
  quote: "text-clearance",
  trip: "text-[var(--success)]",
  member: "text-bone",
  empty_leg: "text-bone",
  preferences: "text-bone-2",
  system: "text-steel",
};

function relativeTime(d: Date): string {
  const ms = Date.now() - d.getTime();
  const m = Math.round(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default async function AuditLogPage() {
  const rows = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      subjectType: auditLog.subjectType,
      subjectId: auditLog.subjectId,
      subjectCode: auditLog.subjectCode,
      diff: auditLog.diff,
      metadata: auditLog.metadata,
      occurredAt: auditLog.occurredAt,
      ip: auditLog.ip,
      actorEmail: users.email,
      actorFirstName: users.firstName,
      actorLastName: users.lastName,
      actorRoleSnapshot: auditLog.actorRole,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorUserId))
    .orderBy(desc(auditLog.occurredAt))
    .limit(200);

  return (
    <div className="container-jn py-10">
      <header className="mb-10">
        <p className="caption mb-3">— Admin · audit log</p>
        <h1 className="font-serif text-[36px] font-light leading-tight tracking-tight text-bone">
          Every state change, in writing.
        </h1>
        <p className="mt-3 max-w-[64ch] text-[14px] leading-[1.55] text-bone-2">
          Append-only log of operational actions across the platform. Useful for Part 295
          compliance, dispute arbitration, and just figuring out what the heck happened.
          Latest 200 events, newest first.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-[4px] border border-ink-3 bg-ink-2 p-12 text-center">
          <p className="caption mb-3">— No audit events yet</p>
          <p className="text-[14px] leading-[1.55] text-bone-2">
            Take an action — submit a quote, update a status, convert to a trip — and the row
            lands here.
          </p>
        </div>
      ) : (
        <div className="rounded-[4px] border border-ink-3 bg-ink-2">
          <ul className="divide-y divide-ink-3">
            {rows.map((r) => {
              const hrefBuilder = SUBJECT_HREF[r.subjectType];
              const href = hrefBuilder && r.subjectId ? hrefBuilder(r.subjectId) : null;
              const actorName =
                [r.actorFirstName, r.actorLastName].filter(Boolean).join(" ") ||
                r.actorEmail ||
                (r.actorRoleSnapshot ?? "system");

              return (
                <li
                  key={r.id}
                  className="grid grid-cols-1 gap-3 px-6 py-5 lg:grid-cols-[150px_140px_1fr_auto] lg:items-baseline lg:gap-6"
                >
                  <div className="flex flex-col">
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
                      {r.occurredAt.toISOString().slice(0, 16).replace("T", " ")}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-bone-2">
                      {relativeTime(r.occurredAt)}
                    </span>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-clearance">
                      {actorName}
                    </span>
                    {r.actorRoleSnapshot ? (
                      <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-steel">
                        {r.actorRoleSnapshot}
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-bone">
                      {r.action}
                    </span>
                    <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
                      <span
                        className={[
                          "rounded-[2px] border border-ink-3 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em]",
                          SUBJECT_CLASS[r.subjectType] ?? "text-bone-2",
                        ].join(" ")}
                      >
                        {r.subjectType.replace(/_/g, " ")}
                      </span>
                      {r.subjectCode ? (
                        href ? (
                          <Link
                            href={href}
                            className="font-mono text-[11px] tracking-[0.04em] text-clearance hover:underline"
                          >
                            {r.subjectCode}
                          </Link>
                        ) : (
                          <span className="font-mono text-[11px] tracking-[0.04em] text-bone-2">
                            {r.subjectCode}
                          </span>
                        )
                      ) : null}
                    </div>
                    {r.diff || r.metadata ? (
                      <pre className="mt-2 max-h-32 overflow-y-auto rounded-[2px] border border-ink-3 bg-ink p-2 font-mono text-[10px] leading-[1.5] text-bone-2">
                        {JSON.stringify(r.diff ?? r.metadata, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                  <span className="font-mono text-[9px] uppercase tracking-[0.04em] text-steel">
                    {r.ip ?? "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
