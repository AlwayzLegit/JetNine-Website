"use server";

import { tripStatusEnum } from "@/db/schema/trips";
import { sessionActor } from "@/domain/actor";
import { runOp } from "@/domain/ops/registry";
import { isDeskMessageChannel } from "@/domain/requests/schemas";
import { invoiceUpdateOp, tripMessageOp, tripStatusOp } from "@/domain/trips/ops";
import { MAX_INVOICE_USD } from "@/domain/trips/schemas";

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
  if (!/^[0-9a-f-]{36}$/i.test(tripId)) return { ok: false, error: "Bad trip id" };
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
// date, then either Save (stay draft) or Finalize (→ due). The work itself
// is the "invoice.update" op (src/domain/trips): the draft lock, the
// concurrency guard, the audit and the issued email live there; runOp
// revalidates the pages. This wrapper turns the form into the op's input
// with the desk's wording for a bad field.

export type InvoiceUpdateResult =
  | { ok: true; status: "draft" | "due" }
  | { ok: false; error: string };

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
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };

  if (!/^[0-9a-f-]{36}$/i.test(invoiceId)) {
    return { ok: false, error: "Bad invoice id" };
  }

  const intent = String(formData.get("intent") ?? "save");
  if (intent !== "save" && intent !== "finalize") {
    return { ok: false, error: "Bad intent" };
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

  // Every field is passed, so the op rewrites the figures the way the form always did.
  const r = await runOp(invoiceUpdateOp, session.value, {
    id: invoiceId,
    intent,
    subtotalUsd,
    fetUsd,
    segmentFeeUsd,
    totalUsd,
    notes,
    dueOn,
  });
  if (!r.ok) return { ok: false, error: r.error };
  if (r.value.kind === "pending") return { ok: false, error: "This was sent for approval." };
  return { ok: true, status: (r.value.value as { status: "draft" | "due" }).status };
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
