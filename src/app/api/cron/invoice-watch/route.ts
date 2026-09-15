import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { invoices } from "@/db/schema/invoices";
import { members } from "@/db/schema/members";
import { users } from "@/db/schema/users";
import { logAudit } from "@/lib/audit";
import { sendDispatchAlert, sendInvoiceReminderEmail } from "@/lib/email";

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
    const [m] = await db
      .select({ email: users.email, firstName: users.firstName })
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .where(eq(members.id, memberId));
    return m?.email ? { email: m.email, firstName: m.firstName || "Hello" } : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const now = new Date();

  // ── Pass 1: due → overdue ──
  const overdueRows = await db
    .update(invoices)
    .set({ status: "overdue", overdueNotifiedAt: now, updatedAt: now })
    .where(
      sql`${invoices.id} in (
        select id from ${invoices}
        where ${invoices.status} = 'due'
          and ${invoices.dueOn} is not null
          and ${invoices.dueOn} < current_date
          and ${invoices.overdueNotifiedAt} is null
        order by ${invoices.dueOn} asc
        limit ${MAX_PER_RUN}
      )`,
    )
    .returning({
      id: invoices.id,
      invoiceCode: invoices.invoiceCode,
      memberId: invoices.memberId,
      totalUsd: invoices.totalUsd,
      dueOn: invoices.dueOn,
      tripId: invoices.tripId,
    });

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
        subject: `[${inv.invoiceCode}] Invoice OVERDUE${inv.totalUsd != null ? ` — $${Math.round(inv.totalUsd).toLocaleString("en-US")}` : ""}`,
        headline: "An invoice went overdue.",
        lines: [
          `Invoice ${inv.invoiceCode} was due ${inv.dueOn ?? "—"} and is unpaid. The member was emailed.`,
        ],
        link: inv.tripId
          ? { label: "Open the trip sheet", url: `https://jetnine.com/admin/trip/${inv.tripId}` }
          : undefined,
      });
    } catch (err) {
      console.error("[invoice-watch] overdue handling failed", { invoice: inv.invoiceCode, err });
    }
  }

  // ── Pass 2: due-soon reminders (due within 2 days) ──
  const dueSoonRows = await db
    .update(invoices)
    .set({ dueReminderSentAt: now, updatedAt: now })
    .where(
      sql`${invoices.id} in (
        select id from ${invoices}
        where ${invoices.status} = 'due'
          and ${invoices.dueOn} is not null
          and ${invoices.dueOn} >= current_date
          and ${invoices.dueOn} <= current_date + 2
          and ${invoices.dueReminderSentAt} is null
        order by ${invoices.dueOn} asc
        limit ${MAX_PER_RUN}
      )`,
    )
    .returning({
      id: invoices.id,
      invoiceCode: invoices.invoiceCode,
      memberId: invoices.memberId,
      totalUsd: invoices.totalUsd,
      dueOn: invoices.dueOn,
    });

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
