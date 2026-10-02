import Link from "next/link";
import { and, desc, eq, ilike, inArray, notInArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { auditLog } from "@/db/schema/audit";
import { users } from "@/db/schema/users";
import { requireAdmin } from "@/lib/auth";
import { auditSentence, whenWords } from "@/lib/desk-history";
import { DeskEmpty, DeskHeader, DeskSearch, DeskTabs } from "@/components/admin/desk-ui";

export const dynamic = "force-dynamic";

type SubjectType = (typeof auditLog.subjectType.enumValues)[number];

// Plain-word tabs over the audit subject types.
const TABS: { key: string; label: string; types: SubjectType[] | null }[] = [
  { key: "all", label: "All", types: null },
  { key: "requests", label: "Requests", types: ["quote"] },
  { key: "trips", label: "Trips", types: ["trip"] },
  { key: "clients", label: "Clients", types: ["member", "membership", "reserve_transaction", "preferences"] },
  { key: "money", label: "Money", types: ["invoice"] },
  { key: "team", label: "Team", types: ["user_role"] },
  { key: "other", label: "Other", types: null },
];

const NAMED_TYPES = TABS.flatMap((t) => t.types ?? []);

type Search = { type?: string; q?: string };
type Props = { searchParams: Promise<Search> };

export default async function HistoryPage({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.type) ?? TABS[0];
  const q = sp.q?.trim() || "";

  const conditions: SQL[] = [];
  if (tab.key === "other") conditions.push(notInArray(auditLog.subjectType, NAMED_TYPES));
  else if (tab.types) conditions.push(inArray(auditLog.subjectType, tab.types));
  if (q) conditions.push(ilike(auditLog.action, `%${q}%`));
  const whereExpr = conditions.length > 0 ? and(...conditions) : undefined;

  // The client's name for the sentence, resolved from the subject row so
  // "Alex sent 3 options to Tom Okafor" reads like the prototype.
  const subjectName = sql<string | null>`case ${auditLog.subjectType}
    when 'quote' then (
      select nullif(trim(coalesce(q.contact_snapshot->>'firstName', '') || ' ' || coalesce(q.contact_snapshot->>'lastName', '')), '')
      from public.quotes q where q.id = ${auditLog.subjectId})
    when 'trip' then (
      select nullif(trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), '')
      from public.trips t join public.members m on m.id = t.member_id join public.users u on u.id = m.user_id
      where t.id = ${auditLog.subjectId})
    when 'invoice' then (
      select nullif(trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), '')
      from public.invoices i join public.members m on m.id = i.member_id join public.users u on u.id = m.user_id
      where i.id = ${auditLog.subjectId})
    when 'member' then (
      select nullif(trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), '')
      from public.members m join public.users u on u.id = m.user_id where m.id = ${auditLog.subjectId})
    when 'membership' then (
      select nullif(trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), '')
      from public.members m join public.users u on u.id = m.user_id where m.id = ${auditLog.subjectId})
    else null end`;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        subjectType: auditLog.subjectType,
        subjectId: auditLog.subjectId,
        subjectCode: auditLog.subjectCode,
        diff: auditLog.diff,
        metadata: auditLog.metadata,
        occurredAt: auditLog.occurredAt,
        actorEmail: users.email,
        actorFirstName: users.firstName,
        actorLastName: users.lastName,
        actorRole: auditLog.actorRole,
        subjectName,
      })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.actorUserId))
      .where(whereExpr)
      .orderBy(desc(auditLog.occurredAt))
      .limit(200),
    db.select({ total: sql<number>`count(*)::int` }).from(auditLog).where(whereExpr),
  ]);

  const now = new Date();

  return (
    <div>
      <DeskHeader
        title="History"
        lead="Who changed what. Here for the rare day you need it."
        actions={<DeskSearch placeholder="Search actions" defaultValue={q} hidden={{ type: tab.key !== "all" ? tab.key : undefined }} />}
      />

      <DeskTabs
        className="mt-6"
        items={TABS.map((t) => ({ key: t.key, label: t.label }))}
        current={tab.key}
        base="/admin/settings/history"
        param="type"
        keep={{ q: q || undefined }}
      />

      {rows.length === 0 ? (
        <DeskEmpty
          className="mt-6"
          title={q || tab.key !== "all" ? "Nothing matches." : "Nothing recorded yet."}
          body={q || tab.key !== "all" ? "Try another tab or clear the search." : "Every change on the desk lands here as it happens."}
        />
      ) : (
        <>
          <div className="card mt-6 overflow-hidden">
            {rows.map((r) => {
              const s = auditSentence(r);
              return (
                <div
                  key={r.id}
                  className="grid grid-cols-1 gap-1 border-b border-line-faint px-6 py-3.5 text-[15px] last:border-b-0 md:grid-cols-[150px_minmax(0,1fr)] md:gap-6"
                >
                  <span className="text-steel">{whenWords(r.occurredAt, now)}</span>
                  <span className="min-w-0 text-bone">
                    {s.pre}
                    {s.link ? (
                      <Link href={s.link.href} className="text-link-strong">
                        {s.link.label}
                      </Link>
                    ) : null}
                    {s.post}
                    {s.ref ? <span className="text-[13px] text-steel"> · {s.ref}</span> : null}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-[13px] text-steel">
            Showing {rows.length} of {total} {total === 1 ? "entry" : "entries"}
            {rows.length < total ? " · newest first" : ""}
          </p>
        </>
      )}
    </div>
  );
}
