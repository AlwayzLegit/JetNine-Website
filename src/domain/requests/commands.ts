import { and, asc, eq, ilike, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { aircraft } from "@/db/schema/aircraft";
import { messages, type NewMessage } from "@/db/schema/audit";
import { members } from "@/db/schema/members";
import { operators } from "@/db/schema/operators";
import { quoteLegs, quotes, quoteStatusEnum, type Quote } from "@/db/schema/quotes";
import { aircraftScheduleBlocks, type NewAircraftScheduleBlock } from "@/db/schema/schedule-blocks";
import { sourcedOptions, type NewSourcedOption, type SourcedOption } from "@/db/schema/sourced-option";
import { staff } from "@/db/schema/staff";
import { users } from "@/db/schema/users";
import { logAudit } from "@/lib/audit";
import { DEFAULT_MARKUP_PCT } from "@/lib/constants";
import { sendQuoteLifecycleEmail, sendQuoteOptionsEmail, type QuoteOptionEmailItem } from "@/lib/email";
import type { ThreadChannel } from "@/lib/message-delivery";
import { isSourcingEligible, normalizeCategory } from "@/lib/operator-eligibility";
import { isE164, toE164 } from "@/lib/phone";
import { statusUrl } from "@/lib/request-status";
import { auditFields, type Actor } from "@/domain/actor";
import { isUuid } from "@/domain/common";
import { err, ok, type Result } from "@/domain/result";
import {
  OPTION_MONEY_FIELDS,
  TRANSMITTING_CHANNELS,
  type DeskMessageChannel,
  type HoldCreateInput,
  type HoldReleaseInput,
  type OptionAddInput,
  type OptionFields,
  type OptionRefInput,
  type OptionUpdateInput,
  type RequestAssignInput,
  type RequestLinkClientInput,
  type RequestMessageInput,
  type RequestStatusInput,
  type SendOptionsInput,
} from "./schemas";

/**
 * Request (quote) commands, shared by the admin's Server Actions, the API
 * and the approval queue through the ops in ./ops.ts. Each op has a
 * `load*` (the current rows, re-read at approval time) and a command that
 * runs against that state. Nothing here checks the session or
 * revalidates: the op declares its paths and `runOp` handles both.
 *
 * Keep this file free of `server-only` imports (twilio, stripe,
 * message-delivery): scripts/check-api.mts loads the route registry
 * under tsx. The transports are reached through a dynamic import.
 */

export type RequestStatus = (typeof quoteStatusEnum.enumValues)[number];
type ContactSnapshot = Quote["contactSnapshot"];

/** The one "no such request" sentence; the Server Actions map it back to the desk's "Quote not found". */
export const REQUEST_NOT_FOUND = "No request with that id.";
const NOT_FOUND = REQUEST_NOT_FOUND;

// Postgres unique-violation SQLSTATE. Drizzle bubbles the underlying
// postgres-js error which exposes `.code` as the SQLSTATE.
export function isUniqueViolation(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  return (e as { code?: string }).code === "23505";
}

/** First time a request reaches options_sent or held, stamp responded_at. */
export function respondedAtPatch(status: RequestStatus): Date | undefined {
  if (status === "options_sent" || status === "held") return new Date();
  return undefined;
}

// ─── Status ──────────────────────────────────────────────────────────────

export type RequestStatusState = {
  quote: { id: string; status: RequestStatus; code: string; memberId: string | null; contactSnapshot: ContactSnapshot };
  /** Contact email, falling back to the linked client's account email. */
  clientEmail: string | null;
  /** Smoke-test requests never email anyone. */
  isSmoke: boolean;
};

export async function loadRequestForStatus(input: RequestStatusInput): Promise<Result<RequestStatusState>> {
  if (!isUuid(input.id)) return err("not_found", NOT_FOUND);
  const [quote] = await db
    .select({
      id: quotes.id,
      status: quotes.status,
      code: quotes.quoteCode,
      memberId: quotes.memberId,
      contactSnapshot: quotes.contactSnapshot,
    })
    .from(quotes)
    .where(eq(quotes.id, input.id))
    .limit(1);
  if (!quote) return err("not_found", NOT_FOUND);

  let clientEmail = quote.contactSnapshot?.email?.trim() || null;
  if (!clientEmail && quote.memberId) {
    const [m] = await db
      .select({ email: users.email })
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .where(eq(members.id, quote.memberId));
    clientEmail = m?.email ?? null;
  }
  const isSmoke =
    (quote.contactSnapshot?.firstName ?? "").toUpperCase().startsWith("[SMOKE]") || (clientEmail ?? "").startsWith("smoke+");
  return ok({ quote, clientEmail, isSmoke });
}

/**
 * The client hears about two transitions: an aircraft placed on hold for
 * them, or their request aging out. Declined is their own action; the
 * rest stay desk-internal. This is the one rule both the risk and the
 * email share, so they can never disagree.
 */
export function lifecycleEmailGoesOut(input: RequestStatusInput, state: RequestStatusState): boolean {
  return (
    (input.status === "held" || input.status === "expired") &&
    state.quote.status !== input.status &&
    Boolean(state.clientEmail) &&
    !state.isSmoke
  );
}

export async function setRequestStatus(
  actor: Actor,
  input: RequestStatusInput,
  state: RequestStatusState,
): Promise<Result<{ id: string; status: RequestStatus }>> {
  const { quote } = state;

  await db
    .update(quotes)
    .set({ status: input.status, respondedAt: respondedAtPatch(input.status) })
    .where(eq(quotes.id, quote.id));

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "quote.status.update",
    subjectType: "quote",
    subjectId: quote.id,
    subjectCode: quote.code,
    diff: { status: { before: quote.status, after: input.status } },
    metadata: a.metadata,
  });

  if (lifecycleEmailGoesOut(input, state) && state.clientEmail) {
    try {
      await sendQuoteLifecycleEmail({
        to: state.clientEmail,
        firstName: quote.contactSnapshot?.firstName?.trim() || "Hello",
        quoteCode: quote.code ?? "",
        kind: input.status as "held" | "expired",
      });
    } catch (e) {
      console.error("quote lifecycle email failed (non-fatal)", e);
    }
  }

  return ok({ id: quote.id, status: input.status });
}

// ─── Thread messages ─────────────────────────────────────────────────────

export type ThreadMessageArgs = {
  subjectType: "quote" | "trip";
  subjectId: string;
  /** JN-… code, for the email subject and the audit row. */
  code: string;
  channel: DeskMessageChannel;
  body: string;
  toAddress: string | null;
  toUserId: string | null;
  fromUserId: string | null;
};

export type ThreadMessageOutcome = {
  messageId: string;
  /** What the audit row records about delivery. */
  delivery: Record<string, unknown>;
};

/**
 * Insert an outbound thread message and, for email / SMS / WhatsApp with
 * an address, hand it to the transport. The row is written first so a
 * failed send still leaves a record; the delivery status is a sidecar.
 * In-app, call and voicemail are desk-side records and are marked
 * `skipped`. Shared by the request and trip message ops so the two can
 * never drift.
 */
export async function postThreadMessage(args: ThreadMessageArgs): Promise<Result<ThreadMessageOutcome>> {
  const { body, channel, toAddress: finalTo } = args;
  const preview = body.length > 140 ? `${body.slice(0, 139)}…` : body;
  const willTransmit = TRANSMITTING_CHANNELS.has(channel) && Boolean(finalTo);
  const initialStatus: "queued" | "skipped" = willTransmit ? "queued" : "skipped";

  const values: NewMessage = {
    subjectType: args.subjectType,
    subjectId: args.subjectId,
    channel,
    direction: "out",
    fromAddress: null,
    toAddress: finalTo,
    fromUserId: args.fromUserId,
    toUserId: args.toUserId,
    preview,
    body,
    isRead: false,
    deliveryStatus: initialStatus,
  };

  let messageId: string;
  try {
    const [row] = await db.insert(messages).values(values).returning({ id: messages.id });
    messageId = row.id;
  } catch (e) {
    console.error(`post ${args.subjectType} message insert failed`, e);
    return err("internal", "DB_INSERT_FAILED");
  }

  let delivery: Record<string, unknown> = { status: initialStatus };
  if (willTransmit && finalTo) {
    // Dynamic on purpose: the transports are `server-only` modules.
    const { dispatchThreadMessage } = await import("@/lib/message-delivery");
    const summary = preview.length > 60 ? `${preview.slice(0, 59)}…` : preview;
    const result = await dispatchThreadMessage(channel as ThreadChannel, {
      to: finalTo,
      subjectCode: args.code,
      subjectSummary: summary,
      body,
    });
    if (result.ok) {
      // Honest status: logger mode means nothing left the building.
      const logger = result.provider === "logger";
      await db
        .update(messages)
        .set({
          deliveryStatus: logger ? "queued" : "sent",
          deliveryProvider: result.provider,
          deliveryMessageId: result.messageId ?? null,
          deliveryError: logger ? "channel not configured — logged only, not delivered" : null,
          deliveredAt: logger ? null : new Date(),
        })
        .where(eq(messages.id, messageId));
      delivery = { status: logger ? "queued" : "sent", provider: result.provider, messageId: result.messageId ?? null };
    } else {
      await db
        .update(messages)
        .set({ deliveryStatus: "failed", deliveryError: result.error.slice(0, 500) })
        .where(eq(messages.id, messageId));
      delivery = { status: "failed", error: result.error };
    }
  }

  return ok({ messageId, delivery });
}

export type RequestMessageState = {
  quote: { id: string; code: string; memberId: string | null; contactSnapshot: ContactSnapshot };
  toUserId: string | null;
  /** The contact's address for this channel, when there is one. */
  defaultTo: string | null;
  /** Where the message will actually go: the given address, else the default. */
  finalTo: string | null;
};

export async function loadRequestForMessage(input: RequestMessageInput): Promise<Result<RequestMessageState>> {
  if (!isUuid(input.id)) return err("not_found", NOT_FOUND);
  const [quote] = await db
    .select({
      id: quotes.id,
      code: quotes.quoteCode,
      memberId: quotes.memberId,
      contactSnapshot: quotes.contactSnapshot,
    })
    .from(quotes)
    .where(eq(quotes.id, input.id))
    .limit(1);
  if (!quote) return err("not_found", NOT_FOUND);

  // Phone channels want E.164. Post-launch requests store it normalised at
  // intake; legacy rows still in "(818) 800-5678" form are re-normalised
  // here so Twilio does not reject them.
  const contactPhoneE164 = quote.contactSnapshot?.phoneE164 ?? null;
  const contactPhoneCC = quote.contactSnapshot?.phoneCountry ?? null;
  const normalizedPhone = isE164(contactPhoneE164) ? contactPhoneE164 : toE164(contactPhoneE164, contactPhoneCC);

  const c = input.channel;
  const defaultTo =
    c === "email"
      ? quote.contactSnapshot?.email ?? null
      : c === "sms" || c === "whatsapp" || c === "call" || c === "voicemail"
        ? normalizedPhone
        : null;

  // The linked client's user id, so their inbox query joins cleanly.
  let toUserId: string | null = null;
  if (quote.memberId) {
    const [m] = await db.select({ userId: members.userId }).from(members).where(eq(members.id, quote.memberId));
    toUserId = m?.userId ?? null;
  }

  return ok({ quote, toUserId, defaultTo, finalTo: input.toAddress ?? defaultTo });
}

export async function postRequestMessage(
  actor: Actor,
  input: RequestMessageInput,
  state: RequestMessageState,
): Promise<Result<{ id: string }>> {
  const { quote } = state;
  const posted = await postThreadMessage({
    subjectType: "quote",
    subjectId: quote.id,
    code: quote.code,
    channel: input.channel,
    body: input.body,
    toAddress: state.finalTo,
    toUserId: state.toUserId,
    fromUserId: actor.userId,
  });
  if (!posted.ok) return posted;

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "quote.message.post",
    subjectType: "quote",
    subjectId: quote.id,
    subjectCode: quote.code,
    metadata: {
      ...a.metadata,
      messageId: posted.value.messageId,
      channel: input.channel,
      toAddress: state.finalTo,
      bodyLen: input.body.length,
      delivery: posted.value.delivery,
    },
  });

  return ok({ id: posted.value.messageId });
}

// ─── Options sheet ───────────────────────────────────────────────────────

export const CATEGORY_EMAIL_LABEL: Record<string, string> = {
  turboprop: "Turboprop",
  light: "Light jet",
  midsize: "Midsize jet",
  supermid: "Super-midsize jet",
  heavy: "Heavy jet",
  ulr: "Ultra long range",
};

export const ARGUS_LABEL: Record<string, string> = {
  platinum: "ARG/US Platinum",
  gold: "ARG/US Gold",
  silver: "ARG/US Silver",
};

export function formatUSDShort(n: number): string {
  return `$${Math.round(n / 1000)}k`;
}

export type SendOptionsState = {
  quote: {
    id: string;
    code: string;
    status: RequestStatus;
    paxCount: number;
    contactSnapshot: ContactSnapshot;
    /** Used only to build the client's status-page link; never returned. */
    statusToken: string | null;
  };
  toEmail: string;
  toUserId: string | null;
  /** Vetted + priced options, in option order. */
  sendable: SourcedOption[];
  /** "LAX → TEB · TEB → LAX" */
  route: string;
  items: QuoteOptionEmailItem[];
};

export async function loadRequestForSendOptions(input: SendOptionsInput): Promise<Result<SendOptionsState>> {
  if (!isUuid(input.id)) return err("not_found", NOT_FOUND);
  const [quote] = await db
    .select({
      id: quotes.id,
      code: quotes.quoteCode,
      status: quotes.status,
      paxCount: quotes.paxCount,
      memberId: quotes.memberId,
      contactSnapshot: quotes.contactSnapshot,
      statusToken: quotes.statusToken,
    })
    .from(quotes)
    .where(eq(quotes.id, input.id))
    .limit(1);
  if (!quote) return err("not_found", NOT_FOUND);

  // Recipient: contact snapshot first, the client's account email as fallback.
  let toEmail = quote.contactSnapshot?.email?.trim() || null;
  let toUserId: string | null = null;
  if (quote.memberId) {
    const [m] = await db
      .select({ userId: members.userId, email: users.email })
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .where(eq(members.id, quote.memberId));
    toUserId = m?.userId ?? null;
    if (!toEmail) toEmail = m?.email ?? null;
  }
  if (!toEmail) return err("invalid", "No client email on this quote");

  // Sendable = vetted operator + priced. Blocked or unmatched options never
  // reach the client by construction.
  const opts = await db
    .select()
    .from(sourcedOptions)
    .where(and(eq(sourcedOptions.quoteId, quote.id), eq(sourcedOptions.safetyFloorPassed, true)))
    .orderBy(asc(sourcedOptions.optionNumber));
  const sendable = opts.filter((o) => o.clientPriceUsd != null && o.clientPriceUsd > 0);
  if (sendable.length === 0) return err("conflict", "No sendable options — need vetted + priced");

  const legs = await db
    .select({ fromIata: quoteLegs.fromIata, toIata: quoteLegs.toIata })
    .from(quoteLegs)
    .where(eq(quoteLegs.quoteId, quote.id))
    .orderBy(asc(quoteLegs.legNumber));
  const route = legs.map((l) => `${l.fromIata ?? "—"} → ${l.toIata ?? "—"}`).join(" · ") || "your route";

  const items: QuoteOptionEmailItem[] = sendable.map((o) => {
    const vetting = [
      o.argusRating && o.argusRating !== "none" ? ARGUS_LABEL[o.argusRating] : null,
      o.wyvernWingman ? "Wyvern Wingman" : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return {
      optionNumber: o.optionNumber,
      aircraftType: o.aircraftType,
      yearOfMake: o.yearOfMake,
      paxCapacity: o.paxCapacity,
      categoryLabel: o.category ? (CATEGORY_EMAIL_LABEL[o.category] ?? o.category) : null,
      vetting: vetting || null,
      clientPriceUsd: o.clientPriceUsd!,
    };
  });

  return ok({ quote, toEmail, toUserId, sendable, route, items });
}

/**
 * Email every sendable option to the client as a branded quote sheet,
 * record the send on the thread with an honest delivery status (a dark
 * email channel records `queued`, not a false `sent`), flip the sent
 * options to `sent_to_client`, and advance the request to options_sent
 * when it is still in an earlier stage.
 */
export async function sendRequestOptions(
  actor: Actor,
  _input: SendOptionsInput,
  state: SendOptionsState,
): Promise<Result<{ count: number; to: string; delivery: "sent" | "queued" }>> {
  const { quote, toEmail, toUserId, sendable, route, items } = state;

  const firstName = quote.contactSnapshot?.firstName?.trim() || "Hello";
  const result = await sendQuoteOptionsEmail({
    quoteCode: quote.code,
    firstName,
    to: toEmail,
    route,
    paxCount: quote.paxCount,
    options: items,
    statusUrl: quote.statusToken ? statusUrl(quote.statusToken) : undefined,
  });
  if (!result.ok) return err("unavailable", `Email failed: ${result.error.slice(0, 120)}`);

  // Honest status: logger mode means nothing actually left the building.
  const delivery: "sent" | "queued" = result.provider === "logger" ? "queued" : "sent";
  const summary = `Options sheet — ${sendable.length} airframe${sendable.length === 1 ? "" : "s"}: ${sendable
    .map((o) => `${o.aircraftType ?? "aircraft"} ${formatUSDShort(o.clientPriceUsd!)}`)
    .join(", ")}`;
  const preview = summary.length > 140 ? `${summary.slice(0, 139)}…` : summary;

  await db.insert(messages).values({
    subjectType: "quote",
    subjectId: quote.id,
    channel: "email",
    direction: "out",
    fromAddress: null,
    toAddress: toEmail,
    fromUserId: actor.userId,
    toUserId,
    preview,
    body: summary,
    isRead: false,
    deliveryStatus: delivery,
    deliveryProvider: result.provider,
    deliveryMessageId: result.messageId ?? null,
    deliveryError: delivery === "queued" ? "email channel not configured — logged only, not delivered" : null,
    deliveredAt: delivery === "sent" ? new Date() : null,
  });

  // Flip the sent options and advance the request (never regress a later state).
  await db
    .update(sourcedOptions)
    .set({ status: "sent_to_client", updatedAt: new Date() })
    .where(
      and(
        eq(sourcedOptions.quoteId, quote.id),
        inArray(
          sourcedOptions.id,
          sendable.map((o) => o.id),
        ),
      ),
    );
  if (["submitted", "triaged", "sourcing"].includes(quote.status)) {
    await db
      .update(quotes)
      .set({ status: "options_sent", respondedAt: new Date(), updatedAt: new Date() })
      .where(eq(quotes.id, quote.id));
  }

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "quote.options.send",
    subjectType: "quote",
    subjectId: quote.id,
    subjectCode: quote.code,
    metadata: { ...a.metadata, count: sendable.length, to: toEmail, provider: result.provider, delivery },
  });

  return ok({ count: sendable.length, to: toEmail, delivery });
}

// ─── Assign a dispatcher ─────────────────────────────────────────────────

export type RequestAssignState = {
  quote: { id: string; code: string; assignedDispatcherId: string | null };
  /** The dispatcher being assigned, when there is one. */
  staff: { id: string; displayName: string } | null;
};

export async function loadRequestForAssign(input: RequestAssignInput): Promise<Result<RequestAssignState>> {
  if (!isUuid(input.id)) return err("not_found", NOT_FOUND);
  const [quote] = await db
    .select({ id: quotes.id, code: quotes.quoteCode, assignedDispatcherId: quotes.assignedDispatcherId })
    .from(quotes)
    .where(eq(quotes.id, input.id))
    .limit(1);
  if (!quote) return err("not_found", NOT_FOUND);

  let who: RequestAssignState["staff"] = null;
  if (input.staffId) {
    if (!isUuid(input.staffId)) return err("invalid", "Unknown dispatcher");
    const [s] = await db
      .select({ id: staff.id, displayName: staff.displayName })
      .from(staff)
      .where(eq(staff.id, input.staffId))
      .limit(1);
    if (!s) return err("invalid", "Unknown dispatcher");
    who = s;
  }
  return ok({ quote, staff: who });
}

export async function assignRequest(
  actor: Actor,
  input: RequestAssignInput,
  state: RequestAssignState,
): Promise<Result<{ id: string; staffId: string | null }>> {
  const { quote } = state;
  await db.update(quotes).set({ assignedDispatcherId: input.staffId }).where(eq(quotes.id, quote.id));

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "quote.dispatcher.assign",
    subjectType: "quote",
    subjectId: quote.id,
    subjectCode: quote.code,
    diff: { assignedDispatcherId: { before: quote.assignedDispatcherId, after: input.staffId } },
    metadata: a.metadata,
  });
  return ok({ id: quote.id, staffId: input.staffId });
}

// ─── Link a client ───────────────────────────────────────────────────────
// The desk-side half of client linkage (the client-side half is the
// signed-in auto-link at intake). Null unlinks. Locked once the request
// is converted: the trip and invoice already carry the client, so a late
// re-link would desync the chain.

export type RequestLinkClientState = {
  quote: { id: string; code: string; memberId: string | null };
  member: { id: string; memberCode: string } | null;
};

export async function loadRequestForLinkClient(input: RequestLinkClientInput): Promise<Result<RequestLinkClientState>> {
  if (!isUuid(input.id)) return err("not_found", NOT_FOUND);
  const [q] = await db
    .select({ id: quotes.id, code: quotes.quoteCode, memberId: quotes.memberId, convertedTripId: quotes.convertedTripId })
    .from(quotes)
    .where(eq(quotes.id, input.id))
    .limit(1);
  if (!q) return err("not_found", NOT_FOUND);
  if (q.convertedTripId) return err("conflict", "Quote already converted — member is locked to the trip");

  let member: RequestLinkClientState["member"] = null;
  if (input.memberId) {
    if (!isUuid(input.memberId)) return err("invalid", "Member not found");
    const [m] = await db
      .select({ id: members.id, memberCode: members.memberCode })
      .from(members)
      .where(eq(members.id, input.memberId))
      .limit(1);
    if (!m) return err("invalid", "Member not found");
    member = m;
  }
  return ok({ quote: { id: q.id, code: q.code, memberId: q.memberId }, member });
}

export async function linkRequestClient(
  actor: Actor,
  input: RequestLinkClientInput,
  state: RequestLinkClientState,
): Promise<Result<{ id: string; memberId: string | null; memberCode: string | null }>> {
  const { quote } = state;
  const memberCode = state.member?.memberCode ?? null;
  await db.update(quotes).set({ memberId: input.memberId, updatedAt: new Date() }).where(eq(quotes.id, quote.id));

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: input.memberId ? "quote.member.attach" : "quote.member.detach",
    subjectType: "quote",
    subjectId: quote.id,
    subjectCode: quote.code,
    diff: { memberId: { before: quote.memberId, after: input.memberId } },
    metadata: { ...a.metadata, memberCode },
  });
  return ok({ id: quote.id, memberId: input.memberId, memberCode });
}

// ─── Soft holds ──────────────────────────────────────────────────────────
// A soft hold puts a `kind='hold'` row on aircraft_schedule_blocks linked
// back to the request. Different dispatchers can hold the same airframe
// for different requests; conflict resolution is human until one is
// promoted to a confirmed trip. The hold window is derived from the
// request's legs: earliest depart → latest depart + a 4-hour buffer for
// flight + ground.

const DEFAULT_HOLD_BUFFER_HOURS = 4;
const HOLD_BLOCKED_STATUSES: readonly string[] = ["accepted", "declined", "expired", "cancelled", "converted"];

export type HoldCreateState = {
  quote: { id: string; code: string; status: RequestStatus };
  aircraft: { id: string; tailNumber: string };
  startAt: Date;
  endAt: Date;
};

export async function loadRequestForHoldCreate(input: HoldCreateInput): Promise<Result<HoldCreateState>> {
  if (!isUuid(input.id)) return err("not_found", NOT_FOUND);
  if (!isUuid(input.aircraftId)) return err("invalid", "Aircraft not found");
  const [q] = await db
    .select({ id: quotes.id, code: quotes.quoteCode, status: quotes.status })
    .from(quotes)
    .where(eq(quotes.id, input.id))
    .limit(1);
  if (!q) return err("not_found", NOT_FOUND);
  if (HOLD_BLOCKED_STATUSES.includes(q.status)) return err("conflict", `Quote is ${q.status} — can't soft-hold`);

  const [ac] = await db
    .select({ id: aircraft.id, tailNumber: aircraft.tailNumber, status: aircraft.status })
    .from(aircraft)
    .where(eq(aircraft.id, input.aircraftId))
    .limit(1);
  if (!ac) return err("invalid", "Aircraft not found");
  if (ac.status === "sold") return err("conflict", "Aircraft is sold");

  // Derive the window from the request's legs.
  const legs = await db
    .select({ departDate: quoteLegs.departDate, departTime: quoteLegs.departTime })
    .from(quoteLegs)
    .where(eq(quoteLegs.quoteId, q.id))
    .orderBy(asc(quoteLegs.departDate), asc(quoteLegs.departTime));
  if (legs.length === 0) return err("conflict", "Quote has no legs");

  function legAt(d: string | null, t: string | null): Date | null {
    if (!d) return null;
    const time = t || "00:00";
    // Treat the value as UTC — there's no per-leg tz on the soft-hold path.
    const iso = `${d}T${time.length === 5 ? `${time}:00` : time}Z`;
    const dd = new Date(iso);
    return Number.isNaN(dd.getTime()) ? null : dd;
  }

  const startAt = legAt(legs[0].departDate, legs[0].departTime);
  const lastLegStart = legAt(legs[legs.length - 1].departDate, legs[legs.length - 1].departTime);
  if (!startAt || !lastLegStart) return err("conflict", "Quote legs lack a usable date");

  const endAt = new Date(lastLegStart.getTime() + DEFAULT_HOLD_BUFFER_HOURS * 60 * 60 * 1000);
  if (endAt <= startAt) return err("conflict", "Computed hold window is degenerate");

  // Soft holds are idempotent against (request, aircraft).
  const [dup] = await db
    .select({ id: aircraftScheduleBlocks.id })
    .from(aircraftScheduleBlocks)
    .where(
      and(
        eq(aircraftScheduleBlocks.aircraftId, ac.id),
        eq(aircraftScheduleBlocks.relatedQuoteId, q.id),
        eq(aircraftScheduleBlocks.kind, "hold"),
      ),
    )
    .limit(1);
  if (dup) return err("conflict", "Already holding this aircraft for this quote");

  return ok({ quote: q, aircraft: { id: ac.id, tailNumber: ac.tailNumber }, startAt, endAt });
}

export async function createHold(
  actor: Actor,
  _input: HoldCreateInput,
  state: HoldCreateState,
): Promise<Result<{ blockId: string; expiresAt: string }>> {
  const { quote, aircraft: ac, startAt, endAt } = state;
  const values: NewAircraftScheduleBlock = {
    aircraftId: ac.id,
    kind: "hold",
    startAt,
    endAt,
    relatedQuoteId: quote.id,
    notes: quote.code,
    createdByUserId: actor.userId,
  };

  try {
    const [row] = await db.insert(aircraftScheduleBlocks).values(values).returning({ id: aircraftScheduleBlocks.id });

    const a = auditFields(actor);
    await logAudit({
      actorUserId: a.actorUserId,
      actorRole: a.actorRole,
      action: "quote.soft_hold.create",
      subjectType: "quote",
      subjectId: quote.id,
      subjectCode: quote.code,
      metadata: {
        ...a.metadata,
        blockId: row.id,
        aircraftId: ac.id,
        tailNumber: ac.tailNumber,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
      },
    });
    return ok({ blockId: row.id, expiresAt: endAt.toISOString() });
  } catch (e) {
    // The partial unique index (migration 0032) catches the race where two
    // people both passed the dup-check above. Same friendly message.
    if (isUniqueViolation(e)) return err("conflict", "Already holding this aircraft for this quote");
    console.error("createHold failed", e);
    return err("internal", "DB_INSERT_FAILED");
  }
}

export type HoldReleaseState = {
  quote: { id: string; code: string };
  block: { id: string; aircraftId: string; tailNumber: string | null };
};

export async function loadRequestForHoldRelease(input: HoldReleaseInput): Promise<Result<HoldReleaseState>> {
  if (!isUuid(input.id)) return err("not_found", NOT_FOUND);
  if (!isUuid(input.blockId)) return err("not_found", "Hold not found");
  const [q] = await db
    .select({ id: quotes.id, code: quotes.quoteCode })
    .from(quotes)
    .where(eq(quotes.id, input.id))
    .limit(1);
  if (!q) return err("not_found", NOT_FOUND);

  const [target] = await db
    .select({
      id: aircraftScheduleBlocks.id,
      kind: aircraftScheduleBlocks.kind,
      relatedQuoteId: aircraftScheduleBlocks.relatedQuoteId,
      aircraftId: aircraftScheduleBlocks.aircraftId,
      tailNumber: aircraft.tailNumber,
    })
    .from(aircraftScheduleBlocks)
    .leftJoin(aircraft, eq(aircraft.id, aircraftScheduleBlocks.aircraftId))
    .where(eq(aircraftScheduleBlocks.id, input.blockId))
    .limit(1);
  if (!target) return err("not_found", "Hold not found");
  if (target.relatedQuoteId !== q.id || target.kind !== "hold") return err("conflict", "Not a soft hold on this quote");

  return ok({ quote: q, block: { id: target.id, aircraftId: target.aircraftId, tailNumber: target.tailNumber } });
}

export async function releaseHold(
  actor: Actor,
  _input: HoldReleaseInput,
  state: HoldReleaseState,
): Promise<Result<{ blockId: string }>> {
  const { quote, block } = state;
  await db.delete(aircraftScheduleBlocks).where(eq(aircraftScheduleBlocks.id, block.id));

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "quote.soft_hold.release",
    subjectType: "quote",
    subjectId: quote.id,
    subjectCode: quote.code,
    metadata: { ...a.metadata, blockId: block.id, aircraftId: block.aircraftId },
  });
  return ok({ blockId: block.id });
}

// ─── Sourced options (Avinode paste-in) ──────────────────────────────────
// Airframes a dispatcher pastes from Avinode while a request is being
// sourced. On save we reconcile the pasted seller name against the
// operators table, snapshot its vetting, enforce the safety floor, and
// apply markup to turn operator cost into client price. The chosen option
// drives trip + invoice pricing at convert.

export function computeClientPrice(costUsd: number | null, markupType: "percent" | "flat", markupValue: number): number | null {
  if (costUsd == null) return null;
  return markupType === "flat" ? costUsd + Math.round(markupValue) : Math.round(costUsd * (1 + markupValue / 100));
}

type MatchedOperator = {
  id: string;
  name: string;
  status: string;
  argusRating: (typeof operators.$inferSelect)["argusRating"];
  wyvernWingman: boolean;
  isbaoStage: number | null;
  insuranceRenewsOn: string | null;
  nextAuditOn: string | null;
};

// Fuzzy-match a pasted Avinode seller name against the operators table: try
// a full contains-match, then fall back to the first token.
async function reconcileOperator(nameRaw: string | null): Promise<MatchedOperator | null> {
  const q = nameRaw?.trim();
  if (!q || q.length < 2) return null;
  const cols = {
    id: operators.id,
    name: operators.name,
    status: operators.status,
    argusRating: operators.argusRating,
    wyvernWingman: operators.wyvernWingman,
    isbaoStage: operators.isbaoStage,
    insuranceRenewsOn: operators.insuranceRenewsOn,
    nextAuditOn: operators.nextAuditOn,
  };
  const [full] = await db.select(cols).from(operators).where(ilike(operators.name, `%${q}%`)).limit(1);
  if (full) return full;
  const first = q.split(/\s+/)[0];
  if (first.length >= 3) {
    const [tok] = await db.select(cols).from(operators).where(ilike(operators.name, `%${first}%`)).limit(1);
    if (tok) return tok;
  }
  return null;
}

/** The pasted fields with every value present: input first, then the base (empty row, or the row being updated). */
type ResolvedOptionFields = {
  avinodeRef: string | null;
  aircraftType: string | null;
  tailNumber: string | null;
  isFloatingFleet: boolean;
  yearOfMake: number | null;
  category: string | null;
  paxCapacity: number | null;
  refurbInteriorYear: number | null;
  refurbExteriorYear: number | null;
  operatorNameRaw: string | null;
  positioningTimeMin: number | null;
  positioningAirport: string | null;
  totalFlightTimeMin: number | null;
  operatorCostUsd: number | null;
  markupType: "percent" | "flat";
  markupValue: number;
  dispatcherNotes: string | null;
};

const EMPTY_OPTION: ResolvedOptionFields = {
  avinodeRef: null,
  aircraftType: null,
  tailNumber: null,
  isFloatingFleet: false,
  yearOfMake: null,
  category: null,
  paxCapacity: null,
  refurbInteriorYear: null,
  refurbExteriorYear: null,
  operatorNameRaw: null,
  positioningTimeMin: null,
  positioningAirport: null,
  totalFlightTimeMin: null,
  operatorCostUsd: null,
  markupType: "percent",
  markupValue: DEFAULT_MARKUP_PCT,
  dispatcherNotes: null,
};

function optionBase(row: SourcedOption): ResolvedOptionFields {
  const mv = row.markupValue == null ? NaN : Number(row.markupValue);
  return {
    avinodeRef: row.avinodeRef,
    aircraftType: row.aircraftType,
    tailNumber: row.tailNumber,
    isFloatingFleet: row.isFloatingFleet,
    yearOfMake: row.yearOfMake,
    category: row.category,
    paxCapacity: row.paxCapacity,
    refurbInteriorYear: row.refurbInteriorYear,
    refurbExteriorYear: row.refurbExteriorYear,
    operatorNameRaw: row.operatorNameRaw,
    positioningTimeMin: row.positioningTimeMin,
    positioningAirport: row.positioningAirport,
    totalFlightTimeMin: row.totalFlightTimeMin,
    operatorCostUsd: row.operatorCostUsd,
    markupType: row.markupType,
    markupValue: Number.isFinite(mv) && mv >= 0 ? mv : DEFAULT_MARKUP_PCT,
    dispatcherNotes: row.dispatcherNotes,
  };
}

/** Cost, markup and notes are money: a caller without that permission may not set them. */
export function optionMoneyCheck(actor: Actor, input: OptionFields): Result<true> {
  if (actor.scopes.has("money")) return ok(true);
  const touches = OPTION_MONEY_FIELDS.some((k) => input[k] !== undefined);
  return touches ? err("forbidden", 'Setting cost, markup or notes needs the "money" permission.') : ok(true);
}

/** Field extraction + operator reconciliation + pricing, shared by add and update. */
async function buildOptionValues(
  input: OptionFields,
  base: ResolvedOptionFields,
): Promise<{ fields: Partial<NewSourcedOption>; meta: { operatorMatched: boolean; safetyFloorPassed: boolean } }> {
  const pick = <K extends keyof ResolvedOptionFields>(k: K): ResolvedOptionFields[K] =>
    (input[k] === undefined ? base[k] : input[k]) as ResolvedOptionFields[K];

  const operatorCostUsd = pick("operatorCostUsd");
  const markupType = pick("markupType");
  const markupValue = pick("markupValue");
  const operatorNameRaw = pick("operatorNameRaw");

  const op = await reconcileOperator(operatorNameRaw);
  const operatorMatched = op !== null;
  const eligibility = op ? isSourcingEligible(op) : null;
  // Safety floor passes only for a matched, eligible operator. An unmatched
  // seller stays false → the UI shows "screen before send" and choose blocks.
  const safetyFloorPassed = operatorMatched && eligibility!.eligible;

  const fields: Partial<NewSourcedOption> = {
    avinodeRef: pick("avinodeRef"),
    aircraftType: pick("aircraftType"),
    tailNumber: pick("tailNumber"),
    isFloatingFleet: pick("isFloatingFleet"),
    yearOfMake: pick("yearOfMake"),
    category: normalizeCategory(pick("category")),
    paxCapacity: pick("paxCapacity"),
    refurbInteriorYear: pick("refurbInteriorYear"),
    refurbExteriorYear: pick("refurbExteriorYear"),
    operatorNameRaw,
    operatorId: op?.id ?? null,
    operatorMatched,
    argusRating: op?.argusRating ?? null,
    wyvernWingman: op?.wyvernWingman ?? null,
    isbaoStage: op?.isbaoStage ?? null,
    safetyFloorPassed,
    positioningTimeMin: pick("positioningTimeMin"),
    positioningAirport: pick("positioningAirport"),
    totalFlightTimeMin: pick("totalFlightTimeMin"),
    operatorCostUsd,
    markupType,
    markupValue: String(markupValue),
    clientPriceUsd: computeClientPrice(operatorCostUsd, markupType, markupValue),
    dispatcherNotes: pick("dispatcherNotes"),
  };
  return { fields, meta: { operatorMatched, safetyFloorPassed } };
}

export type OptionAddState = {
  quote: { id: string; code: string };
  /** The ordinal the new option will take. */
  optionNumber: number;
};

export async function loadRequestForOptionAdd(input: OptionAddInput): Promise<Result<OptionAddState>> {
  if (!isUuid(input.id)) return err("not_found", NOT_FOUND);
  const [quote] = await db
    .select({ id: quotes.id, code: quotes.quoteCode })
    .from(quotes)
    .where(eq(quotes.id, input.id))
    .limit(1);
  if (!quote) return err("not_found", NOT_FOUND);
  const [{ maxNum }] = await db
    .select({ maxNum: sql<number>`coalesce(max(${sourcedOptions.optionNumber}), 0)` })
    .from(sourcedOptions)
    .where(eq(sourcedOptions.quoteId, quote.id));
  return ok({ quote, optionNumber: Number(maxNum) + 1 });
}

export async function addOption(
  actor: Actor,
  input: OptionAddInput,
  state: OptionAddState,
): Promise<Result<{ optionId: string; optionNumber: number }>> {
  const money = optionMoneyCheck(actor, input);
  if (!money.ok) return money;
  const { quote, optionNumber } = state;
  const built = await buildOptionValues(input, EMPTY_OPTION);

  const [row] = await db
    .insert(sourcedOptions)
    .values({ quoteId: quote.id, optionNumber, ...built.fields })
    .returning({ id: sourcedOptions.id });

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "quote.option.add",
    subjectType: "quote",
    subjectId: quote.id,
    subjectCode: quote.code,
    metadata: {
      ...a.metadata,
      optionId: row.id,
      optionNumber,
      ...built.meta,
      operatorCostUsd: built.fields.operatorCostUsd,
      clientPriceUsd: built.fields.clientPriceUsd,
    },
  });
  return ok({ optionId: row.id, optionNumber });
}

export type OptionState = {
  quote: { id: string; code: string };
  option: SourcedOption;
};

/** The request and one of its options; an option on another request is "not found" here. */
export async function loadRequestOption(input: OptionRefInput): Promise<Result<OptionState>> {
  if (!isUuid(input.id)) return err("not_found", NOT_FOUND);
  if (!isUuid(input.optionId)) return err("not_found", "Option not found");
  const [quote] = await db
    .select({ id: quotes.id, code: quotes.quoteCode })
    .from(quotes)
    .where(eq(quotes.id, input.id))
    .limit(1);
  if (!quote) return err("not_found", NOT_FOUND);
  const [option] = await db
    .select()
    .from(sourcedOptions)
    .where(and(eq(sourcedOptions.id, input.optionId), eq(sourcedOptions.quoteId, quote.id)))
    .limit(1);
  if (!option) return err("not_found", "Option not found");
  return ok({ quote, option });
}

export async function updateOption(
  actor: Actor,
  input: OptionUpdateInput,
  state: OptionState,
): Promise<Result<{ optionId: string }>> {
  const money = optionMoneyCheck(actor, input);
  if (!money.ok) return money;
  const { quote, option } = state;
  const built = await buildOptionValues(input, optionBase(option));

  await db
    .update(sourcedOptions)
    .set({ ...built.fields, updatedAt: new Date() })
    .where(eq(sourcedOptions.id, option.id));

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "quote.option.update",
    subjectType: "quote",
    subjectId: quote.id,
    subjectCode: quote.code,
    metadata: { ...a.metadata, optionId: option.id, ...built.meta },
  });
  return ok({ optionId: option.id });
}

/** Choose needs a vetted, priced option; the same words the desk shows. */
export function optionChooseGuard(option: SourcedOption): Result<true> {
  if (!option.safetyFloorPassed) {
    return err(
      "conflict",
      option.operatorMatched ? "Operator fails the safety floor — cannot choose" : "Operator unmatched — screen + match before choosing",
    );
  }
  if (option.clientPriceUsd == null || option.clientPriceUsd <= 0) {
    return err("conflict", "Set operator cost + markup before choosing");
  }
  return ok(true);
}

export async function loadRequestForOptionChoose(input: OptionRefInput): Promise<Result<OptionState>> {
  const loaded = await loadRequestOption(input);
  if (!loaded.ok) return loaded;
  const guard = optionChooseGuard(loaded.value.option);
  return guard.ok ? loaded : guard;
}

export async function chooseOption(
  actor: Actor,
  _input: OptionRefInput,
  state: OptionState,
): Promise<Result<{ optionId: string }>> {
  const { quote, option } = state;
  await db.transaction(async (tx) => {
    await tx
      .update(sourcedOptions)
      .set({ isChosen: false, updatedAt: new Date() })
      .where(eq(sourcedOptions.quoteId, quote.id));
    await tx
      .update(sourcedOptions)
      .set({ isChosen: true, status: "shortlisted", updatedAt: new Date() })
      .where(eq(sourcedOptions.id, option.id));
  });

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "quote.option.choose",
    subjectType: "quote",
    subjectId: quote.id,
    subjectCode: quote.code,
    metadata: { ...a.metadata, optionId: option.id, clientPriceUsd: option.clientPriceUsd, operatorCostUsd: option.operatorCostUsd },
  });
  return ok({ optionId: option.id });
}

export async function removeOption(
  actor: Actor,
  _input: OptionRefInput,
  state: OptionState,
): Promise<Result<{ optionId: string }>> {
  const { quote, option } = state;
  await db.delete(sourcedOptions).where(eq(sourcedOptions.id, option.id));

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "quote.option.remove",
    subjectType: "quote",
    subjectId: quote.id,
    subjectCode: quote.code,
    metadata: { ...a.metadata, optionId: option.id },
  });
  return ok({ optionId: option.id });
}
