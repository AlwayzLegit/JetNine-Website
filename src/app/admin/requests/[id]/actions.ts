"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sourcedOptions } from "@/db/schema/sourced-option";
import { DEFAULT_MARKUP_PCT } from "@/lib/constants";
import { sessionActor } from "@/domain/actor";
import { runOp } from "@/domain/ops/registry";
import { REQUEST_NOT_FOUND } from "@/domain/requests/commands";
import {
  requestAssignOp,
  requestConvertOp,
  requestHoldCreateOp,
  requestHoldReleaseOp,
  requestLinkClientOp,
  requestMessageOp,
  requestOptionAddOp,
  requestOptionChooseOp,
  requestOptionRemoveOp,
  requestOptionUpdateOp,
  requestSendOptionsOp,
  requestStatusOp,
} from "@/domain/requests/ops";
import { isDeskMessageChannel, type OptionFields } from "@/domain/requests/schemas";
import { issueWords, type Err } from "@/domain/result";

const UUID_RE = /^[0-9a-f-]{36}$/i;
const PENDING = "This was sent for approval.";

/**
 * The desk's wording for an op error: the shared "no request" sentence
 * becomes "Quote not found", a validation failure names the field, and the
 * rest already reads the way the desk did.
 */
function deskError(r: Err): string {
  if (r.code === "not_found" && r.error === REQUEST_NOT_FOUND) return "Quote not found";
  if (r.code === "invalid") return issueWords(r) ?? r.error;
  return r.error;
}


// The work itself is the "request.status" op (src/domain/requests), shared
// with the API and the approval queue; runOp revalidates the pages.
export async function updateQuoteStatus(
  quoteId: string,
  status: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };
  if (!UUID_RE.test(quoteId)) return { ok: false, error: "Bad quote id" };
  const r = await runOp(requestStatusOp, session.value, { id: quoteId, status });
  if (!r.ok) return { ok: false, error: r.code === "invalid" ? "Invalid status" : r.code === "not_found" ? "Quote not found" : r.error };
  if (r.value.kind === "pending") return { ok: false, error: "This was sent for approval." };
  return { ok: true };
}

// The work itself is the "request.assign" op (src/domain/requests).
export async function assignDispatcher(
  quoteId: string,
  staffId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };
  if (!UUID_RE.test(quoteId)) return { ok: false, error: "Bad quote id" };
  if (staffId !== null && !UUID_RE.test(staffId)) return { ok: false, error: "Unknown dispatcher" };
  const r = await runOp(requestAssignOp, session.value, { id: quoteId, staffId });
  if (!r.ok) return { ok: false, error: r.code === "invalid" ? "Unknown dispatcher" : deskError(r) };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };
  return { ok: true };
}

// ─── attachMemberToQuote ──────────────────────────────────────────
// The dispatcher-side half of member linkage (the customer-side half is
// the signed-in auto-link in submitQuote). Pass null to detach. The work
// itself is the "request.linkClient" op (src/domain/requests), which also
// holds the converted lock.

export async function attachMemberToQuote(
  quoteId: string,
  memberId: string | null,
): Promise<{ ok: true; memberCode: string | null } | { ok: false; error: string }> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };
  if (!UUID_RE.test(quoteId)) return { ok: false, error: "Bad quote id" };
  if (memberId !== null && !UUID_RE.test(memberId)) return { ok: false, error: "Bad member id" };
  const r = await runOp(requestLinkClientOp, session.value, { id: quoteId, memberId });
  if (!r.ok) return { ok: false, error: r.code === "invalid" ? "Member not found" : deskError(r) };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };
  return { ok: true, memberCode: (r.value.value as { memberCode: string | null }).memberCode };
}

// ─── convertQuoteToTrip ───────────────────────────────────────────
// Promotes an accepted quote into a real trip + a draft invoice. The work
// itself is the "request.convert" op (src/domain/requests): the pricing,
// the one transaction (trip, legs, invoice, reserve drawdown, hold release,
// converted stamp), the audit rows and the booking confirmation email all
// live there; runOp revalidates the pages.

export async function convertQuoteToTrip(
  quoteId: string,
): Promise<{ ok: true; tripId: string; tripCode: string; invoiceId: string } | { ok: false; error: string }> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };
  const r = await runOp(requestConvertOp, session.value, { id: quoteId });
  if (!r.ok) return { ok: false, error: deskError(r) };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };
  const { tripId, tripCode, invoiceId } = r.value.value as { tripId: string; tripCode: string; invoiceId: string };
  return { ok: true, tripId, tripCode, invoiceId };
}

// ─── Messaging thread ───────────────────────────────────────────────
// Posts a dispatcher-authored message on a quote thread. Direction is always
// "out" — inbound messages arrive via webhook (Twilio / Postmark) which is
// not wired yet. Channel "system" is reserved for status-change auto-notes.
// The work itself is the "request.message" op (src/domain/requests).

export type PostQuoteMessageResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function postQuoteMessage(
  quoteId: string,
  formData: FormData,
): Promise<PostQuoteMessageResult> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };

  const channel = ((formData.get("channel") as string | null) ?? "").trim();
  if (!isDeskMessageChannel(channel)) {
    return { ok: false, error: "Pick a channel" };
  }

  const body = ((formData.get("body") as string | null) ?? "").trim();
  if (body.length < 1) return { ok: false, error: "Body required" };
  if (body.length > 4000) return { ok: false, error: "Body too long (4000 max)" };

  const toAddress = ((formData.get("toAddress") as string | null) ?? "").trim() || undefined;

  const r = await runOp(requestMessageOp, session.value, { id: quoteId, channel, body, toAddress });
  if (!r.ok) return { ok: false, error: r.code === "not_found" ? "Quote not found" : r.error };
  if (r.value.kind === "pending") return { ok: false, error: "This was sent for approval." };
  return { ok: true, id: (r.value.value as { id: string }).id };
}

// ─── Soft holds ───────────────────────────────────────────────────────
// The work itself is the "request.hold.create" / "request.hold.release"
// ops (src/domain/requests): window derivation, dedupe and the race guard
// all live there.

export type CreateSoftHoldResult =
  | { ok: true; blockId: string; expiresAt: string }
  | { ok: false; error: string };

export async function createSoftHold(
  quoteId: string,
  aircraftId: string,
): Promise<CreateSoftHoldResult> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };
  if (!UUID_RE.test(quoteId)) return { ok: false, error: "Bad quote id" };
  if (!UUID_RE.test(aircraftId)) return { ok: false, error: "Bad aircraft id" };
  const r = await runOp(requestHoldCreateOp, session.value, { id: quoteId, aircraftId });
  if (!r.ok) return { ok: false, error: deskError(r) };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };
  const { blockId, expiresAt } = r.value.value as { blockId: string; expiresAt: string };
  return { ok: true, blockId, expiresAt };
}

export async function releaseSoftHold(
  quoteId: string,
  blockId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };
  if (!UUID_RE.test(quoteId)) return { ok: false, error: "Bad quote id" };
  if (!UUID_RE.test(blockId)) return { ok: false, error: "Bad block id" };
  const r = await runOp(requestHoldReleaseOp, session.value, { id: quoteId, blockId });
  if (!r.ok) return { ok: false, error: deskError(r) };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };
  return { ok: true };
}

// ─── Sourced options (Avinode paste-in) ────────────────────────────────────
// Airframes a dispatcher pastes from Avinode during a quote's `sourcing`
// state. The work itself is the "request.option.*" ops (src/domain/requests):
// operator reconciliation, the safety floor and the markup pricing live
// there. These wrappers turn the form into the op's input.

export type SourcedOptionResult =
  | { ok: true; optionId: string }
  | { ok: false; error: string };

function soStr(v: FormDataEntryValue | null): string | null {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? null : s;
}
function soInt(v: FormDataEntryValue | null): number | null {
  const s = v == null ? "" : String(v).trim();
  if (s === "") return null;
  const n = Math.round(Number(s));
  return Number.isFinite(n) ? n : null;
}
function soBool(v: FormDataEntryValue | null): boolean {
  const s = String(v ?? "").toLowerCase();
  return s === "on" || s === "true" || s === "1";
}

/** The form's fields as the op's input; every field is set, so the op rewrites the whole row the way the form always did. */
function optionFieldsFromForm(formData: FormData): { fields: OptionFields } | { error: string } {
  const rawMarkup = soStr(formData.get("markupValue"));
  const markupValue = rawMarkup === null ? DEFAULT_MARKUP_PCT : Number(rawMarkup);
  if (!Number.isFinite(markupValue) || markupValue < 0) {
    return { error: "Markup must be a non-negative number" };
  }
  return {
    fields: {
      avinodeRef: soStr(formData.get("avinodeRef")),
      aircraftType: soStr(formData.get("aircraftType")),
      tailNumber: soStr(formData.get("tailNumber")),
      isFloatingFleet: soBool(formData.get("isFloatingFleet")),
      yearOfMake: soInt(formData.get("yearOfMake")),
      category: soStr(formData.get("category")),
      paxCapacity: soInt(formData.get("paxCapacity")),
      refurbInteriorYear: soInt(formData.get("refurbInteriorYear")),
      refurbExteriorYear: soInt(formData.get("refurbExteriorYear")),
      operatorNameRaw: soStr(formData.get("operatorNameRaw")),
      positioningTimeMin: soInt(formData.get("positioningTimeMin")),
      positioningAirport: soStr(formData.get("positioningAirport")),
      totalFlightTimeMin: soInt(formData.get("totalFlightTimeMin")),
      operatorCostUsd: soInt(formData.get("operatorCostUsd")),
      markupType: String(formData.get("markupType") ?? "percent") === "flat" ? "flat" : "percent",
      markupValue,
      dispatcherNotes: soStr(formData.get("dispatcherNotes")),
    },
  };
}

/** The option's request, so the op can check the option belongs to it. */
async function quoteIdForOption(optionId: string): Promise<{ quoteId: string } | { error: string }> {
  if (!UUID_RE.test(optionId)) return { error: "Bad option id" };
  const [opt] = await db
    .select({ quoteId: sourcedOptions.quoteId })
    .from(sourcedOptions)
    .where(eq(sourcedOptions.id, optionId))
    .limit(1);
  return opt ? { quoteId: opt.quoteId } : { error: "Option not found" };
}

export async function addSourcedOption(
  quoteId: string,
  formData: FormData,
): Promise<SourcedOptionResult> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };
  if (!UUID_RE.test(quoteId)) return { ok: false, error: "Bad quote id" };
  const built = optionFieldsFromForm(formData);
  if ("error" in built) return { ok: false, error: built.error };
  const r = await runOp(requestOptionAddOp, session.value, { id: quoteId, ...built.fields });
  if (!r.ok) return { ok: false, error: deskError(r) };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };
  return { ok: true, optionId: (r.value.value as { optionId: string }).optionId };
}

export async function updateSourcedOption(
  optionId: string,
  formData: FormData,
): Promise<SourcedOptionResult> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };
  const ref = await quoteIdForOption(optionId);
  if ("error" in ref) return { ok: false, error: ref.error };
  const built = optionFieldsFromForm(formData);
  if ("error" in built) return { ok: false, error: built.error };
  const r = await runOp(requestOptionUpdateOp, session.value, { id: ref.quoteId, optionId, ...built.fields });
  if (!r.ok) return { ok: false, error: deskError(r) };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };
  return { ok: true, optionId };
}

export async function chooseSourcedOption(optionId: string): Promise<SourcedOptionResult> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };
  const ref = await quoteIdForOption(optionId);
  if ("error" in ref) return { ok: false, error: ref.error };
  const r = await runOp(requestOptionChooseOp, session.value, { id: ref.quoteId, optionId });
  if (!r.ok) return { ok: false, error: deskError(r) };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };
  return { ok: true, optionId };
}

export async function deleteSourcedOption(optionId: string): Promise<SourcedOptionResult> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };
  const ref = await quoteIdForOption(optionId);
  if ("error" in ref) return { ok: false, error: ref.error };
  const r = await runOp(requestOptionRemoveOp, session.value, { id: ref.quoteId, optionId });
  if (!r.ok) return { ok: false, error: deskError(r) };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };
  return { ok: true, optionId };
}

// ─── Send options to the client ───────────────────────────────────────────
// The action that closes the funnel. The work itself is the
// "request.sendOptions" op (src/domain/requests), shared with the API.

export type SendOptionsResult =
  | { ok: true; count: number; to: string; delivery: "sent" | "queued" }
  | { ok: false; error: string };

export async function sendOptionsToClient(quoteId: string): Promise<SendOptionsResult> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };
  if (!UUID_RE.test(quoteId)) return { ok: false, error: "Bad quote id" };
  const r = await runOp(requestSendOptionsOp, session.value, { id: quoteId });
  if (!r.ok) return { ok: false, error: r.code === "not_found" ? "Quote not found" : r.error };
  if (r.value.kind === "pending") return { ok: false, error: "This was sent for approval." };
  const { count, to, delivery } = r.value.value as { count: number; to: string; delivery: "sent" | "queued" };
  return { ok: true, count, to, delivery };
}
