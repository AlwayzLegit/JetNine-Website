import Link from "next/link";
import { desc, asc, count } from "drizzle-orm";
import { db } from "@/db";
import { operators } from "@/db/schema/operators";
import { aircraft } from "@/db/schema/aircraft";
import { OperatorCreateForm } from "@/components/admin/operator-create-form";
import { DeskEmpty, DeskHeader, DeskPage, DotSentence, NumberCard } from "@/components/admin/desk-ui";

export const dynamic = "force-dynamic";

type Tone = "gold" | "steel" | "success" | "danger";

const STATUS_WORDS: Record<string, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "success" },
  audit_due: { label: "Audit due", tone: "gold" },
  hold: { label: "On hold", tone: "steel" },
  suspended: { label: "Suspended", tone: "danger" },
  banned: { label: "Banned", tone: "danger" },
};

const ARGUS_WORDS: Record<string, string> = {
  platinum: "Platinum",
  gold: "Gold",
  silver: "Silver",
  none: "Not rated",
};

function daysUntil(date: Date | string | null, now: Date): number | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  return Math.round((d.getTime() - now.getTime()) / 86_400_000);
}

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(`${date}T12:00:00Z`) : date;
  return Number.isNaN(d.getTime()) ? String(date) : DATE_FMT.format(d);
}

export default async function OperatorsPage() {
  const now = new Date();
  const rows = await db
    .select({
      id: operators.id,
      name: operators.name,
      certNumber: operators.certNumber,
      homeAirportIcao: operators.homeAirportIcao,
      yearsPartner: operators.yearsPartner,
      isPreferred: operators.isPreferred,
      status: operators.status,
      argusRating: operators.argusRating,
      wyvernWingman: operators.wyvernWingman,
      isbaoStage: operators.isbaoStage,
      nextAuditOn: operators.nextAuditOn,
      insuranceRenewsOn: operators.insuranceRenewsOn,
      suspendedReason: operators.suspendedReason,
    })
    .from(operators)
    .orderBy(desc(operators.isPreferred), asc(operators.name));

  // Aircraft counts per operator in one query.
  const counts = await db
    .select({
      operatorId: aircraft.operatorId,
      n: count(),
    })
    .from(aircraft)
    .groupBy(aircraft.operatorId);
  const fleetByOperator = new Map(counts.map((c) => [c.operatorId, c.n]));

  const totals = {
    operators: rows.length,
    active: rows.filter((r) => r.status === "active").length,
    auditDue: rows.filter((r) => r.status === "audit_due").length,
    suspended: rows.filter((r) => r.status === "suspended" || r.status === "hold").length,
  };

  return (
    <DeskPage>
      <DeskHeader
        back={{ href: "/admin/settings/reference", label: "Reference data" }}
        title="Operators"
        lead="Vetting state, insurance and audit cycle for every operator in the network. Suspended operators are left out of sourcing; operators with an audit due are flagged as a reminder for the desk."
      />

      <div className="mt-6 flex justify-end">
        <OperatorCreateForm />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <NumberCard label="Operators" value={totals.operators} />
        <NumberCard label="Active" value={totals.active} />
        <NumberCard label="Audit due" value={totals.auditDue} />
        <NumberCard
          label="On hold or suspended"
          value={totals.suspended}
          note={totals.suspended > 0 ? "Left out of sourcing" : undefined}
          noteTone={totals.suspended > 0 ? "danger" : "steel"}
        />
      </div>

      {rows.length === 0 ? (
        <DeskEmpty title="No operators yet." body="Add the first operator above to start building the network." />
      ) : (
        <div className="card mt-8 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-jn min-w-[1200px]">
              <thead>
                <tr>
                  {[
                    "Operator",
                    "Certificate",
                    "Home base",
                    "Status",
                    "ARG/US",
                    "Wyvern",
                    "IS-BAO",
                    "Audit due",
                    "Aircraft",
                    "",
                  ].map((h, i) => (
                    <th key={h || i}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const audit = daysUntil(r.nextAuditOn, now);
                  const isAuditWarn = audit !== null && audit >= 0 && audit < 60;
                  const isAuditPast = audit !== null && audit < 0;
                  const status = STATUS_WORDS[r.status] ?? {
                    label: r.status.replace(/_/g, " "),
                    tone: "steel" as Tone,
                  };
                  return (
                    <tr
                      key={r.id}
                      className={[
                        "transition-colors hover:bg-surface-2/50",
                        r.status === "suspended" || r.status === "hold" ? "opacity-70" : "",
                      ].join(" ")}
                    >
                      <td>
                        <div className="flex flex-wrap items-center gap-2.5">
                          <Link
                            href={`/admin/operators/${r.id}`}
                            className="text-[16px] font-medium text-bone hover:underline"
                          >
                            {r.name}
                          </Link>
                          {r.isPreferred ? <span className="pill pill-clearance">Preferred</span> : null}
                        </div>
                        {r.suspendedReason ? (
                          <div className="mt-1 max-w-[44ch] text-[13px] text-danger">{r.suspendedReason}</div>
                        ) : null}
                        {r.yearsPartner ? (
                          <div className="mt-1 text-[13px] text-steel">
                            {r.yearsPartner} year{r.yearsPartner === 1 ? "" : "s"} as a partner
                          </div>
                        ) : null}
                      </td>
                      <td className="text-bone-2">{r.certNumber ?? "—"}</td>
                      <td className="text-bone">{r.homeAirportIcao ?? "—"}</td>
                      <td>
                        <span className="pill pill-outline">
                          <DotSentence tone={status.tone}>{status.label}</DotSentence>
                        </span>
                      </td>
                      <td className="text-bone-2">{ARGUS_WORDS[r.argusRating] ?? r.argusRating}</td>
                      <td>
                        {r.wyvernWingman ? (
                          <span className="text-success">Wingman</span>
                        ) : (
                          <span className="text-steel">—</span>
                        )}
                      </td>
                      <td className="text-bone-2">{r.isbaoStage ? `Stage ${r.isbaoStage}` : "—"}</td>
                      <td>
                        {r.nextAuditOn ? (
                          <span className={isAuditPast ? "text-danger" : isAuditWarn ? "text-gold" : "text-bone-2"}>
                            {formatDate(r.nextAuditOn)}
                            {audit !== null
                              ? isAuditPast
                                ? ` · ${Math.abs(audit)} days past`
                                : ` · in ${audit} days`
                              : ""}
                          </span>
                        ) : (
                          <span className="text-steel">—</span>
                        )}
                      </td>
                      <td className="text-bone">{fleetByOperator.get(r.id) ?? 0}</td>
                      <td className="text-right">
                        <Link href={`/admin/operators/${r.id}`} className="btn btn-secondary btn-sm">
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DeskPage>
  );
}
