import { NextResponse, type NextRequest } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { messages, type NewMessage } from "@/db/schema/audit";
import { members } from "@/db/schema/members";
import { users } from "@/db/schema/users";
import { quotes } from "@/db/schema/quotes";
import { trips } from "@/db/schema/trips";
import { logAudit } from "@/lib/audit";
import { isTwilioConfigured, verifyTwilioSignature } from "@/lib/twilio";

// Inbound SMS webhook — Twilio POSTs form-urlencoded data here when a
// customer SMS-replies to one of our outbound numbers.
//
// Threading strategy:
//   1. If the customer's reply contains a [QT-NNNN-NNNN] / [JN-...] code
//      (because they kept our prefix on the original line), route to
//      that thread.
//   2. Otherwise look up the sender's phone in `users.phone_e164` and
//      attach to their most-recent active quote or trip. Heuristic, but
//      good enough for v1 — most member SMS conversations are about
//      the trip currently in motion.
//   3. If neither resolves, log + ACK so Twilio doesn't retry.
//
// Security: X-Twilio-Signature HMAC verification against the auth token.
// Without TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN the route returns 503
// so Twilio retries until env is configured.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SUBJECT_CODE_RE = /\[((?:QT|JN)-\d{4}-\d+)\]/i;

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isTwilioConfigured()) {
    return NextResponse.json({ error: "twilio not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(rawBody)) {
    params[k] = v;
  }

  // Reconstruct the exact URL Twilio called. Vercel passes the original
  // host + proto in x-forwarded-*; behind the edge router request.url
  // would otherwise be the internal hostname.
  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const pathAndQuery = new URL(request.url).pathname + new URL(request.url).search;
  const fullUrl = `${forwardedProto}://${forwardedHost}${pathAndQuery}`;

  const sig = request.headers.get("x-twilio-signature");
  if (!verifyTwilioSignature(fullUrl, params, sig)) {
    console.warn("[twilio:inbound] signature mismatch", { url: fullUrl });
    return NextResponse.json({ error: "invalid signature" }, { status: 403 });
  }

  const messageSid = params.MessageSid ?? "";
  const from = params.From ?? "";
  const body = (params.Body ?? "").slice(0, 4000);
  const isWhatsApp = from.startsWith("whatsapp:");
  const fromE164 = isWhatsApp ? from.slice("whatsapp:".length) : from;

  const route = await resolveInboundRoute({ body, fromE164 });
  if (!route) {
    console.warn("[twilio:inbound] no matching thread", {
      messageSid,
      from: fromE164,
      bodyPreview: body.slice(0, 80),
    });
    // ACK so Twilio doesn't retry. The message is lost from the
    // dispatcher's perspective; ops can grep logs for these.
    return NextResponse.json({ received: true, unmatched: true });
  }

  const preview = body.length > 140 ? `${body.slice(0, 139)}…` : body;

  const values: NewMessage = {
    subjectType: route.subjectType,
    subjectId: route.subjectId,
    channel: "sms", // WhatsApp is its own channel-to-be; for now group with SMS
    direction: "in",
    fromAddress: fromE164,
    toAddress: params.To ?? null,
    fromUserId: null,
    toUserId: route.toUserId,
    preview,
    body,
    isRead: false,
    deliveryStatus: "sent",
    deliveryProvider: "twilio",
    deliveryMessageId: messageSid || null,
    deliveredAt: new Date(),
  };

  let messageId: string;
  try {
    const [row] = await db.insert(messages).values(values).returning({ id: messages.id });
    messageId = row.id;
  } catch (err) {
    // Unique-violation on the inbound idempotency index = duplicate
    // Twilio delivery for the same MessageSid. 200 OK so Twilio stops
    // retrying.
    const code = (err as { code?: string })?.code;
    if (code === "23505") {
      return NextResponse.json({ received: true, deduped: true });
    }
    console.error("[twilio:inbound] insert failed", err);
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }

  try {
    await logAudit({
      actorUserId: null,
      actorRole: "system",
      action: `${route.subjectType}.message.inbound`,
      subjectType: route.subjectType,
      subjectId: route.subjectId,
      subjectCode: route.subjectCode,
      metadata: {
        messageId,
        channel: "sms",
        fromAddress: fromE164,
        providerMessageId: messageSid,
        bodyLen: body.length,
        isWhatsApp,
      },
    });
  } catch (err) {
    console.error("[twilio:inbound] audit failed (non-fatal)", err);
  }

  return NextResponse.json({ received: true, messageId });
}

type InboundRoute = {
  subjectType: "quote" | "trip";
  subjectId: string;
  subjectCode: string;
  toUserId: string | null;
};

async function resolveInboundRoute(args: {
  body: string;
  fromE164: string;
}): Promise<InboundRoute | null> {
  // Strategy 1: bracketed code in the body.
  const match = SUBJECT_CODE_RE.exec(args.body);
  if (match) {
    const code = match[1].toUpperCase();
    if (code.startsWith("QT-")) {
      const [q] = await db
        .select({
          id: quotes.id,
          memberUserId: members.userId,
        })
        .from(quotes)
        .leftJoin(members, eq(members.id, quotes.memberId))
        .where(eq(quotes.quoteCode, code));
      if (q) {
        return {
          subjectType: "quote",
          subjectId: q.id,
          subjectCode: code,
          toUserId: q.memberUserId ?? null,
        };
      }
    } else if (code.startsWith("JN-")) {
      const [t] = await db
        .select({
          id: trips.id,
          memberUserId: members.userId,
        })
        .from(trips)
        .innerJoin(members, eq(members.id, trips.memberId))
        .where(eq(trips.tripCode, code));
      if (t) {
        return {
          subjectType: "trip",
          subjectId: t.id,
          subjectCode: code,
          toUserId: t.memberUserId,
        };
      }
    }
  }

  // Strategy 2: phone-based lookup. Find the user by phone, then their
  // most recent non-completed trip or non-closed quote.
  if (!args.fromE164) return null;
  const [u] = await db
    .select({ userId: users.id })
    .from(users)
    .where(eq(users.phoneE164, args.fromE164));
  if (!u) return null;

  const [member] = await db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.userId, u.userId));
  if (!member) return null;

  // Prefer the most recent active trip.
  const ACTIVE_TRIP_STATUSES = [
    "confirmed",
    "crew_briefed",
    "boarding",
    "airborne",
    "wheels_down",
  ] as const;
  const [recentTrip] = await db
    .select({ id: trips.id, code: trips.tripCode })
    .from(trips)
    .where(and(eq(trips.memberId, member.id), inArray(trips.status, ACTIVE_TRIP_STATUSES)))
    .orderBy(desc(trips.createdAt))
    .limit(1);
  if (recentTrip) {
    return {
      subjectType: "trip",
      subjectId: recentTrip.id,
      subjectCode: recentTrip.code,
      toUserId: u.userId,
    };
  }

  // Fall back: most recent quote in any open state.
  const OPEN_QUOTE_STATUSES = [
    "submitted",
    "triaged",
    "sourcing",
    "options_sent",
    "held",
    "accepted",
  ] as const;
  const [recentQuote] = await db
    .select({ id: quotes.id, code: quotes.quoteCode })
    .from(quotes)
    .where(and(eq(quotes.memberId, member.id), inArray(quotes.status, OPEN_QUOTE_STATUSES)))
    .orderBy(desc(quotes.receivedAt))
    .limit(1);
  if (recentQuote) {
    return {
      subjectType: "quote",
      subjectId: recentQuote.id,
      subjectCode: recentQuote.code,
      toUserId: u.userId,
    };
  }

  return null;
}
