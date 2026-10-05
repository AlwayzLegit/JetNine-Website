import Link from "next/link";
import { OperatorCreateForm } from "@/components/admin/operator-create-form";
import { DeskEmpty, DeskHeader, DeskPage, DotSentence, NumberCard } from "@/components/admin/desk-ui";
import { listOperators } from "@/domain/reference/queries";

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
  const { operators: rows, totals } = await listOperators();

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
            <table className="table-jn min-w-[1200px] text-[14px] [&_th]:bg-surface-2 [&_th]:py-2.5 [&_th]:text-[12px] [&_th]:font-bold [&_th]:text-bone">
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
                      <td className="text-bone">{r.fleetCount}</td>
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
