import Link from "next/link";
import { desc, asc, count } from "drizzle-orm";
import { db } from "@/db";
import { operators } from "@/db/schema/operators";
import { aircraft } from "@/db/schema/aircraft";
import { OperatorCreateForm } from "@/components/admin/operator-create-form";

export const dynamic = "force-dynamic";

const STATUS_CLASS: Record<string, string> = {
  active: "border-[var(--success)] text-[var(--success)]",
  audit_due: "border-[var(--warn)] text-[var(--warn)]",
  hold: "border-bone-2 text-bone-2",
  suspended: "border-[var(--error)] text-[var(--error)]",
  banned: "border-[var(--error)] text-[var(--error)]",
};

const ARGUS_CLASS: Record<string, string> = {
  platinum: "border-clearance text-clearance",
  gold: "border-[#C9A961] text-[#C9A961]",
  silver: "border-bone-2 text-bone-2",
  none: "border-steel text-steel",
};

function daysUntil(date: Date | string | null): number | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  return Math.round((d.getTime() - Date.now()) / 86_400_000);
}

export default async function OperatorsPage() {
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
    <div className="container-jn py-10">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="caption mb-3">— Admin · operators</p>
          <h1 className="font-serif text-[36px] font-light leading-tight tracking-tight text-bone">
            {totals.operators} operators in the network.
          </h1>
          <p className="mt-3 max-w-[60ch] text-[14px] leading-[1.55] text-bone-2">
            Vetting state, insurance, audit cycle. Suspended operators are excluded from sourcing UI;
            audit-due operators get yellow highlight as a reminder for the desk.
          </p>
        </div>
        <div className="flex flex-col items-end gap-4">
          <dl className="flex flex-wrap gap-x-10 gap-y-3 text-right">
            {[
              ["TOTAL", String(totals.operators)],
              ["ACTIVE", String(totals.active)],
              ["AUDIT DUE", String(totals.auditDue)],
              ["HOLD / SUSP", String(totals.suspended)],
            ].map(([lbl, val]) => (
              <div key={lbl} className="flex flex-col items-end">
                <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
                  {lbl}
                </dt>
                <dd
                  className={[
                    "mt-1 font-serif text-[26px] font-light leading-none",
                    lbl === "HOLD / SUSP" && totals.suspended > 0
                      ? "text-[var(--error)]"
                      : "text-bone",
                  ].join(" ")}
                >
                  {val}
                </dd>
              </div>
            ))}
          </dl>
          <OperatorCreateForm />
        </div>
      </header>

      {/* Desktop: table. Below md it swaps to stacked cards (the table needs
          sideways-scroll to reach status / vetting / audit columns). */}
      <div className="hidden overflow-x-auto rounded-[4px] border border-ink-3 bg-ink-2 md:block">
        <table className="w-full min-w-[1200px] border-collapse text-left">
          <thead>
            <tr className="border-b border-ink-3">
              {[
                "Operator",
                "Cert #",
                "Base",
                "Status",
                "ARG/US",
                "Wyvern",
                "IS-BAO",
                "Audit due",
                "Fleet",
                "",
              ].map((h, i) => (
                <th
                  key={h || i}
                  className="px-5 py-4 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const audit = daysUntil(r.nextAuditOn);
              const isAuditWarn = audit !== null && audit >= 0 && audit < 60;
              const isAuditPast = audit !== null && audit < 0;
              return (
                <tr
                  key={r.id}
                  className={[
                    "border-b border-ink-3 transition-colors hover:bg-ink",
                    r.status === "audit_due" ? "bg-[rgba(184,137,60,0.04)]" : "",
                    r.status === "suspended" || r.status === "hold" ? "opacity-70" : "",
                  ].join(" ")}
                >
                  <td className="px-5 py-5">
                    <div className="flex items-baseline gap-3">
                      <span className="font-serif text-[17px] font-normal text-bone">{r.name}</span>
                      {r.isPreferred ? (
                        <span className="rounded-[2px] bg-clearance px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-ink">
                          Preferred
                        </span>
                      ) : null}
                    </div>
                    {r.suspendedReason ? (
                      <div className="mt-1 max-w-[44ch] font-mono text-[10px] tracking-[0.04em] text-[var(--error)]">
                        — {r.suspendedReason}
                      </div>
                    ) : null}
                    {r.yearsPartner ? (
                      <div className="mt-1 font-mono text-[10px] tracking-[0.04em] text-steel">
                        — {r.yearsPartner}y partner
                      </div>
                    ) : null}
                  </td>
                  <td className="px-5 py-5 font-mono text-[11px] tracking-[0.04em] text-bone-2">
                    {r.certNumber ?? "—"}
                  </td>
                  <td className="px-5 py-5 font-mono text-[11px] tracking-[0.06em] text-bone">
                    {r.homeAirportIcao ?? "—"}
                  </td>
                  <td className="px-5 py-5">
                    <span
                      className={[
                        "inline-block rounded-full border px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]",
                        STATUS_CLASS[r.status] ?? "border-ink-3 text-bone-2",
                      ].join(" ")}
                    >
                      {r.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-5 py-5">
                    <span
                      className={[
                        "inline-block rounded-[2px] border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]",
                        ARGUS_CLASS[r.argusRating] ?? "border-steel text-steel",
                      ].join(" ")}
                    >
                      {r.argusRating}
                    </span>
                  </td>
                  <td className="px-5 py-5 font-mono text-[11px] text-bone-2">
                    {r.wyvernWingman ? (
                      <span className="text-clearance">✓ Wingman</span>
                    ) : (
                      <span className="text-steel">—</span>
                    )}
                  </td>
                  <td className="px-5 py-5 font-mono text-[11px] text-bone-2">
                    {r.isbaoStage ? `Stage ${r.isbaoStage}` : "—"}
                  </td>
                  <td className="px-5 py-5 font-mono text-[11px]">
                    {r.nextAuditOn ? (
                      <span
                        className={
                          isAuditPast
                            ? "text-[var(--error)]"
                            : isAuditWarn
                              ? "text-[var(--warn)]"
                              : "text-bone-2"
                        }
                      >
                        {String(r.nextAuditOn)}
                        {audit !== null
                          ? isAuditPast
                            ? ` · ${Math.abs(audit)}d past`
                            : ` · ${audit}d`
                          : ""}
                      </span>
                    ) : (
                      <span className="text-steel">—</span>
                    )}
                  </td>
                  <td className="px-5 py-5 font-mono text-[12px] tracking-[0.04em] text-clearance">
                    {fleetByOperator.get(r.id) ?? 0}
                  </td>
                  <td className="px-5 py-5 text-right">
                    <Link
                      href={`/admin/operators/${r.id}`}
                      className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-clearance"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {rows.map((r) => {
          const audit = daysUntil(r.nextAuditOn);
          const isAuditWarn = audit !== null && audit >= 0 && audit < 60;
          const isAuditPast = audit !== null && audit < 0;
          return (
            <Link
              key={r.id}
              href={`/admin/operators/${r.id}`}
              className={[
                "block rounded-[4px] border border-ink-3 bg-ink-2 p-4 transition-colors hover:bg-ink",
                r.status === "suspended" || r.status === "hold" ? "opacity-70" : "",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-baseline gap-2">
                  <span className="font-serif text-[17px] font-normal text-bone">{r.name}</span>
                  {r.isPreferred ? (
                    <span className="rounded-[2px] bg-clearance px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-ink">
                      Preferred
                    </span>
                  ) : null}
                </div>
                <span
                  className={[
                    "inline-block shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]",
                    STATUS_CLASS[r.status] ?? "border-ink-3 text-bone-2",
                  ].join(" ")}
                >
                  {r.status.replace(/_/g, " ")}
                </span>
              </div>
              {r.suspendedReason ? (
                <div className="mt-1 font-mono text-[10px] tracking-[0.04em] text-[var(--error)]">
                  — {r.suspendedReason}
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={[
                    "inline-block rounded-[2px] border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]",
                    ARGUS_CLASS[r.argusRating] ?? "border-steel text-steel",
                  ].join(" ")}
                >
                  ARG/US {r.argusRating}
                </span>
                {r.wyvernWingman ? (
                  <span className="rounded-[2px] border border-clearance px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-clearance">
                    Wyvern
                  </span>
                ) : null}
                {r.isbaoStage ? (
                  <span className="rounded-[2px] border border-bone-2 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-bone-2">
                    IS-BAO {r.isbaoStage}
                  </span>
                ) : null}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-ink-3 pt-3 font-mono text-[10px] uppercase tracking-[0.08em] text-bone-2">
                <div>Base <span className="text-bone">{r.homeAirportIcao ?? "—"}</span></div>
                <div>Fleet <span className="text-clearance">{fleetByOperator.get(r.id) ?? 0}</span></div>
                <div>Cert <span className="text-bone">{r.certNumber ?? "—"}</span></div>
                <div>
                  Audit{" "}
                  {r.nextAuditOn ? (
                    <span
                      className={
                        isAuditPast
                          ? "text-[var(--error)]"
                          : isAuditWarn
                            ? "text-[var(--warn)]"
                            : "text-bone"
                      }
                    >
                      {audit !== null
                        ? isAuditPast
                          ? `${Math.abs(audit)}d past`
                          : `${audit}d`
                        : String(r.nextAuditOn)}
                    </span>
                  ) : (
                    <span className="text-steel">—</span>
                  )}
                </div>
              </dl>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
