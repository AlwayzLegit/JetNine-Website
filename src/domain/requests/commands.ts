import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { messages, type NewMessage } from "@/db/schema/audit";
import { members } from "@/db/schema/members";
import { quoteLegs, quotes, quoteStatusEnum, type Quote } from "@/db/schema/quotes";
import { sourcedOptions, type SourcedOption } from "@/db/schema/sourced-option";
import { users } from "@/db/schema/users";
import { logAudit } from "@/lib/audit";
import { sendQuoteLifecycleEmail, sendQuoteOptionsEmail, type QuoteOptionEmailItem } from "@/lib/email";
import type { ThreadChannel } from "@/lib/message-delivery";
import { isE164, toE164 } from "@/lib/phone";
import { statusUrl } from "@/lib/request-status";
import { auditFields, type Actor } from "@/domain/actor";
import { isUuid } from "@/domain/common";
import { err, ok, type Result } from "@/domain/result";
import {
  TRANSMITTING_CHANNELS,
  type DeskMessageChannel,
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

const NOT_FOUND = "No request with that id.";

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
