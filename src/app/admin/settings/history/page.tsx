import Link from "next/link";
import { and, desc, eq, ilike, sql, SQL } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, auditSubjectTypeEnum } from "@/db/schema/audit";
import { users } from "@/db/schema/users";

export const dynamic = "force-dynamic";

// Map subject_type → href builder.
const SUBJECT_HREF: Partial<Record<string, (id: string) => string>> = {
  quote: (id) => `/admin/quote/${id}`,
  trip: (id) => `/admin/trip/${id}`,
  member: (id) => `/admin/member/${id}`,
  operator: (id) => `/admin/operators/${id}`,
  aircraft: (id) => `/admin/aircraft/${id}`,
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

const SUBJECT_TYPES = auditSubjectTypeEnum.enumValues as readonly string[];

function relativeTime(d: Date): string {
  const ms = Date.now() - d.getTime();
  const m = Math.round(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

type Search = {
  type?: string;
  q?: string;
  actor?: string;
};

type Props = { searchParams: Promise<Search> };

export default async function AuditLogPage({ searchParams }: Props) {
  const sp = await searchParams;
  const typeFilter = sp.type && SUBJECT_TYPES.includes(sp.type) ? sp.type : null;
  const actionFilter = sp.q?.trim() || null;
  const actorFilter = sp.actor?.trim() || null;

  const conditions: SQL[] = [];
  if (typeFilter) {
    conditions.push(
      eq(
        auditLog.subjectType,
        typeFilter as typeof auditLog.subjectType.enumValues[number],
      ),
    );
  }
  if (actionFilter) conditions.push(ilike(auditLog.action, `%${actionFilter}%`));
  if (actorFilter) conditions.push(ilike(users.email, `%${actorFilter}%`));

  const whereExpr = conditions.length > 0 ? and(...conditions) : undefined;

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
    .where(whereExpr)
    .orderBy(desc(auditLog.occurredAt))
    .limit(200);

  // Total count (without limit) so the "showing N of M" line is honest.
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorUserId))
    .where(whereExpr);

  const hasFilter = Boolean(typeFilter || actionFilter || actorFilter);

  return (
    <div className="container-jn py-10">
      <header className="mb-8">
        <p className="caption mb-3">— Admin · audit log</p>
        <h1 className="font-serif text-[36px] font-light leading-tight tracking-tight text-bone">
          Every state change, in writing.
        </h1>
        <p className="mt-3 max-w-[64ch] text-[14px] leading-[1.55] text-bone-2">
          Append-only log of operational actions across the platform. Useful for Part 295
          compliance, dispute arbitration, and just figuring out what the heck happened. Filter by
          subject, action, or actor; newest first; capped at 200 rows per query.
        </p>
      </header>

      {/* Filters */}
      <form
        method="get"
        className="mb-6 grid gap-3 rounded-[4px] border border-ink-3 bg-ink-2 p-5 md:grid-cols-[1fr_1fr_1fr_auto]"
      >
        <div className="field-jn">
          <label htmlFor="al-type">Subject</label>
          <select id="al-type" name="type" defaultValue={typeFilter ?? ""}>
            <option value="">— All subjects</option>
            {SUBJECT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="field-jn">
          <label htmlFor="al-q">Action contains</label>
          <input
            id="al-q"
            name="q"
            type="text"
            placeholder="e.g. status.update"
            defaultValue={actionFilter ?? ""}
          />
        </div>
        <div className="field-jn">
          <label htmlFor="al-actor">Actor email</label>
          <input
            id="al-actor"
            name="actor"
            type="text"
            placeholder="riley@"
            defaultValue={actorFilter ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <button type="submit" className="btn btn-primary btn-sm">
            Filter <span className="arrow">→</span>
          </button>
          {hasFilter ? (
            <Link
              href="/admin/audit"
              className="text-center font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-clearance"
            >
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.12em] text-steel">
        — Showing {rows.length} of {total}
        {hasFilter ? " filtered" : ""} event{total === 1 ? "" : "s"}
      </p>

      {rows.length === 0 ? (
        <div className="rounded-[4px] border border-ink-3 bg-ink-2 p-12 text-center">
          <p className="caption mb-3">— {hasFilter ? "No matches" : "No audit events yet"}</p>
          <p className="text-[14px] leading-[1.55] text-bone-2">
            {hasFilter
              ? "Loosen the filters or clear them."
              : "Take an action — submit a quote, update a status, convert to a trip — and the row lands here."}
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
