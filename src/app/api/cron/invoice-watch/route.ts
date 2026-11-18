import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { invoiceStore } from "@/domain/invoices/store";
import { logAudit } from "@/lib/audit";
import { sendDispatchAlert, sendInvoiceReminderEmail } from "@/lib/email";
import { formatDay } from "@/lib/request-format";

// Invoice dunning — daily. Two passes:
//   1. due → overdue: the `overdue` status existed but nothing ever
//      transitioned into it. Flips past-due invoices, emails the member,
//      pages the desk. Once per invoice (overdue_notified_at claim).
//   2. due-soon reminder: `due` invoices with due_on within 2 days get one
//      member reminder (due_reminder_sent_at claim).
// Both claims are stamped in the same statement that selects rows, so an
// overlapping run can't double-send. Capped per run.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_PER_RUN = 20;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function memberContact(
  memberId: string | null,
): Promise<{ email: string; firstName: string } | null> {
  if (!memberId) return null;
  try {
    const m = await invoiceStore().memberContact(memberId);
    return m ? { email: m.email, firstName: m.firstName || "Hello" } : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const now = new Date();
  // The store reads the day itself on Postgres (current_date); the D1 adapter takes the UTC day
  // from here, which is what current_date is on the Postgres database.
  const today = now.toISOString().slice(0, 10);
  const until = new Date(now.getTime() + 2 * 86_400_000).toISOString().slice(0, 10);
  const store = invoiceStore();

  // ── Pass 1: due → overdue ──
  const overdueRows = await store.claimOverdue({ today, limit: MAX_PER_RUN, now });

  let overdueEmailed = 0;
  for (const inv of overdueRows) {
    try {
      await logAudit({
        actorUserId: null,
        actorRole: "system",
        action: "invoice.overdue",
        subjectType: "invoice",
        subjectId: inv.id,
        subjectCode: inv.invoiceCode,
        diff: { status: { before: "due", after: "overdue" } },
        metadata: { dueOn: inv.dueOn, totalUsd: inv.totalUsd, source: "cron" },
      });
      const contact = await memberContact(inv.memberId);
      if (contact) {
        const r = await sendInvoiceReminderEmail({
          to: contact.email,
          firstName: contact.firstName,
          invoiceCode: inv.invoiceCode,
          totalUsd: inv.totalUsd,
          dueOn: inv.dueOn,
          kind: "overdue",
        });
        if (r.ok) overdueEmailed += 1;
      }
      await sendDispatchAlert({
        subject: `[${inv.invoiceCode}] Invoice overdue${inv.totalUsd != null ? ` — $${Math.round(inv.totalUsd).toLocaleString("en-US")}` : ""}`,
        headline: "An invoice is overdue.",
        lines: [
          `It was due ${formatDay(inv.dueOn) ?? inv.dueOn ?? "—"} and hasn't been paid.${contact ? " The client was emailed a reminder." : ""}`,
          `Reference ${inv.invoiceCode}`,
        ],
        link: inv.tripId
          ? { label: "Open the trip", url: `https://jetnine.com/admin/trips/${inv.tripId}` }
          : undefined,
      });
    } catch (err) {
      console.error("[invoice-watch] overdue handling failed", { invoice: inv.invoiceCode, err });
    }
  }

  // ── Pass 2: due-soon reminders (due within 2 days) ──
  const dueSoonRows = await store.claimDueSoon({ today, until, limit: MAX_PER_RUN, now });

  let remindersSent = 0;
  for (const inv of dueSoonRows) {
    try {
      const contact = await memberContact(inv.memberId);
      if (contact) {
        const r = await sendInvoiceReminderEmail({
          to: contact.email,
          firstName: contact.firstName,
          invoiceCode: inv.invoiceCode,
          totalUsd: inv.totalUsd,
          dueOn: inv.dueOn,
          kind: "due_soon",
        });
        if (r.ok) remindersSent += 1;
      }
    } catch (err) {
      console.error("[invoice-watch] reminder failed", { invoice: inv.invoiceCode, err });
    }
  }

  return NextResponse.json({
    ok: true,
    overdue: overdueRows.length,
    overdueEmailed,
    dueSoon: dueSoonRows.length,
    remindersSent,
  });
}
