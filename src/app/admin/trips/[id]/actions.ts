"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { trips, tripStatusEnum } from "@/db/schema/trips";
import { invoices } from "@/db/schema/invoices";
import { members } from "@/db/schema/members";
import { users } from "@/db/schema/users";
import { requireStaff } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { sendInvoiceIssuedEmail } from "@/lib/email";
import { sessionActor } from "@/domain/actor";
import { runOp } from "@/domain/ops/registry";
import { isDeskMessageChannel } from "@/domain/requests/schemas";
import { tripMessageOp, tripStatusOp } from "@/domain/trips/ops";

type Status = (typeof tripStatusEnum.enumValues)[number];

function isStatus(v: string): v is Status {
  return (tripStatusEnum.enumValues as readonly string[]).includes(v);
}

// The work itself is the "trip.status" op (src/domain/trips): wheels
// timestamps, cancellation refunds (reserve + card) and the client
// notifications all live there; runOp revalidates the pages.
export async function updateTripStatus(
  tripId: string,
  status: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };
  if (!isStatus(status)) return { ok: false, error: "Invalid status" };
  const r = await runOp(tripStatusOp, session.value, { id: tripId, status });
  if (!r.ok) return { ok: false, error: r.code === "invalid" ? "Invalid status" : r.code === "not_found" ? "Trip not found" : r.error };
  if (r.value.kind === "pending") return { ok: false, error: "This was sent for approval." };
  return { ok: true };
}

// ─── Invoice finalize (draft → due) ──────────────────────────────────────
//
// The last unbuilt segment of the money path (#34). convertQuoteToTrip
// creates the invoice as `draft` (unless an immediate reserve drawdown
// flips it straight to `paid`); a draft has no member-facing Pay button
// until a dispatcher reviews the figures and finalizes it to `due`. This
// action backs the editor on the trip sheet: edit the money fields + due
// date, then either Save (stay draft) or Finalize (→ due). Editing is
// locked once the invoice leaves `draft`.

export type InvoiceUpdateResult =
  | { ok: true; status: "draft" | "due" }
  | { ok: false; error: string };

// Stripe's per-line-item ceiling is 99,999,999 cents; our amounts are
// whole USD, so the same number is a safe upper bound in dollars too.
const MAX_INVOICE_USD = 99_999_999;

// Parse a money field: empty → null (unknown), otherwise a rounded
// integer. Returns NaN as an invalid-input sentinel the caller rejects.
function parseUsdField(v: FormDataEntryValue | null): number | null {
  if (v === null) return null;
  const s = String(v).trim();
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n);
}

export async function updateInvoice(
  invoiceId: string,
  formData: FormData,
): Promise<InvoiceUpdateResult> {
  const actor = await requireStaff();

  if (!/^[0-9a-f-]{36}$/i.test(invoiceId)) {
    return { ok: false, error: "Bad invoice id" };
  }

  const intent = String(formData.get("intent") ?? "save");
  if (intent !== "save" && intent !== "finalize") {
    return { ok: false, error: "Bad intent" };
  }

  const [inv] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
  if (!inv) return { ok: false, error: "Invoice not found" };
  if (inv.status !== "draft") {
    return { ok: false, error: `Invoice is ${inv.status} — only drafts are editable` };
  }

  const subtotalUsd = parseUsdField(formData.get("subtotalUsd"));
  const fetUsd = parseUsdField(formData.get("fetUsd"));
  const segmentFeeUsd = parseUsdField(formData.get("segmentFeeUsd"));
  const totalUsd = parseUsdField(formData.get("totalUsd"));

  for (const [label, val] of [
    ["Subtotal", subtotalUsd],
    ["FET", fetUsd],
    ["Segment fee", segmentFeeUsd],
    ["Total", totalUsd],
  ] as const) {
    if (typeof val === "number" && Number.isNaN(val)) {
      return { ok: false, error: `${label} must be a number` };
    }
    if (val !== null && (val < 0 || val > MAX_INVOICE_USD)) {
      return { ok: false, error: `${label} is out of range` };
    }
  }

  const notesRaw = String(formData.get("notes") ?? "").trim();
  const notes = notesRaw === "" ? null : notesRaw.slice(0, 2000);

  const dueOnRaw = String(formData.get("dueOn") ?? "").trim();
  let dueOn: string | null = null;
  if (dueOnRaw !== "") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueOnRaw) || Number.isNaN(Date.parse(dueOnRaw))) {
      return { ok: false, error: "Due date must be a valid YYYY-MM-DD" };
    }
    dueOn = dueOnRaw;
  }

  if (intent === "finalize" && (totalUsd === null || totalUsd <= 0)) {
    return { ok: false, error: "Total must be greater than zero to finalize" };
  }

  const patch: Partial<typeof invoices.$inferInsert> = {
    subtotalUsd,
    fetUsd,
    segmentFeeUsd,
    totalUsd,
    notes,
    updatedAt: new Date(),
  };
  if (dueOn !== null) patch.dueOn = dueOn;

  if (intent === "finalize") {
    patch.status = "due";
    // A due invoice should carry a due date; default to +7 days when the
    // dispatcher didn't set one and the row doesn't already have one.
    if (dueOn === null && !inv.dueOn) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + 7);
      patch.dueOn = d.toISOString().slice(0, 10);
    }
  }

  // Constrain to status='draft' so a concurrent finalize can't be
  // double-applied; empty result means someone else moved it first.
  const updated = await db
    .update(invoices)
    .set(patch)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.status, "draft")))
    .returning({ id: invoices.id });

  if (updated.length === 0) {
    return { ok: false, error: "Invoice changed under you — reload the sheet" };
  }

  const diff: Record<string, unknown> = {
    subtotalUsd: { before: inv.subtotalUsd, after: subtotalUsd },
    fetUsd: { before: inv.fetUsd, after: fetUsd },
    segmentFeeUsd: { before: inv.segmentFeeUsd, after: segmentFeeUsd },
    totalUsd: { before: inv.totalUsd, after: totalUsd },
  };
  if (intent === "finalize") {
    diff.status = { before: "draft", after: "due" };
  }

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: intent === "finalize" ? "invoice.finalize" : "invoice.draft.update",
    subjectType: "invoice",
    subjectId: invoiceId,
    subjectCode: inv.invoiceCode,
    diff,
    metadata: { intent, dueOn: patch.dueOn ?? inv.dueOn ?? null },
  });

  // Finalizing puts money on the table — tell the member rather than let
  // them discover the invoice by browsing /account/invoices. Best-effort.
  if (intent === "finalize" && inv.memberId && totalUsd !== null) {
    try {
      const [m] = await db
        .select({ email: users.email, firstName: users.firstName })
        .from(members)
        .innerJoin(users, eq(users.id, members.userId))
        .where(eq(members.id, inv.memberId));
      if (m?.email) {
        let tripCode: string | null = null;
        if (inv.tripId) {
          const [t] = await db
            .select({ tripCode: trips.tripCode })
            .from(trips)
            .where(eq(trips.id, inv.tripId));
          tripCode = t?.tripCode ?? null;
        }
        await sendInvoiceIssuedEmail({
          to: m.email,
          firstName: m.firstName || "Hello",
          invoiceCode: inv.invoiceCode,
          tripCode,
          totalUsd,
          dueOn: (patch.dueOn ?? inv.dueOn ?? null) as string | null,
        });
      }
    } catch (err) {
      console.error("invoice-issued email failed (non-fatal)", err);
    }
  }

  if (inv.tripId) {
    revalidatePath(`/admin/trips/${inv.tripId}`);
  }
  revalidatePath("/admin/trips");
  revalidatePath("/account/invoices");

  return { ok: true, status: intent === "finalize" ? "due" : "draft" };
}

// ─── Messaging thread (subject_type='trip') ──────────────────────────────
// The work itself is the "trip.message" op (src/domain/trips), shared with
// the API and the approval queue.

export type PostTripMessageResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function postTripMessage(
  tripId: string,
  formData: FormData,
): Promise<PostTripMessageResult> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };

  const channel = ((formData.get("channel") as string | null) ?? "").trim();
  if (!isDeskMessageChannel(channel)) return { ok: false, error: "Pick a channel" };

  const body = ((formData.get("body") as string | null) ?? "").trim();
  if (body.length < 1) return { ok: false, error: "Body required" };
  if (body.length > 4000) return { ok: false, error: "Body too long (4000 max)" };

  const toAddress = ((formData.get("toAddress") as string | null) ?? "").trim() || undefined;

  const r = await runOp(tripMessageOp, session.value, { id: tripId, channel, body, toAddress });
  if (!r.ok) return { ok: false, error: r.code === "not_found" ? "Trip not found" : r.error };
  if (r.value.kind === "pending") return { ok: false, error: "This was sent for approval." };
  return { ok: true, id: (r.value.value as { id: string }).id };
}
