import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { messages, type NewMessage } from "@/db/schema/audit";
import { members } from "@/db/schema/members";
import { quotes } from "@/db/schema/quotes";
import { trips } from "@/db/schema/trips";
import { logAudit } from "@/lib/audit";
import { isTwilioConfigured, verifyTwilioSignature } from "@/lib/twilio";

// Inbound SMS / WhatsApp webhook — Twilio POSTs form-urlencoded data
// here when a customer replies to one of our outbound numbers.
//
// Threading strategy:
//   1. The customer's reply MUST contain a [QT-NNNN-NNNN] / [JN-...]
//      code (because they kept our prefix on the original line) for
//      the message to thread. Pure caller-ID routing was removed —
//      SMS sender IDs are trivially spoofable via SMS gateways / SIP
//      providers, so an attacker who knew (or guessed) a member's
//      phone could inject "instructions" into that member's dispatch
//      thread that dispatchers would treat as authentic. Requiring
//      the bracketed code raises the bar — an attacker would also
//      need the QT/JN code, which is private to the thread.
//   2. If no code resolves, log + ACK so Twilio doesn't retry. The
//      message is lost from the dispatcher's perspective; ops can
//      grep logs for these and reach out manually.
//
// Security:
//   - X-Twilio-Signature HMAC verification against the auth token
//   - Subject-code requirement (above) prevents caller-ID spoofing
//   - Without TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN the route returns
//     503 so Twilio retries until env is configured

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

  const route = await resolveInboundRoute(body);
  if (!route) {
    console.warn("[twilio:inbound] no subject code in body — dropping", {
      messageSid,
      from: fromE164,
      bodyPreview: body.slice(0, 80),
    });
    // ACK so Twilio doesn't retry. The message is lost from the
    // dispatcher's perspective; ops can grep logs for these.
    return NextResponse.json({ received: true, unmatched: true });
  }

  const preview = body.length > 140 ? `${body.slice(0, 139)}…` : body;

  // Match the channel to the channel the outbound was sent on so the
  // thread view doesn't split the conversation. Previously inbound
  // WhatsApp replies were written as channel='sms' while outbound
  // WhatsApp was channel='whatsapp', so dispatcher per-channel filters
  // showed half the conversation under each tab.
  const values: NewMessage = {
    subjectType: route.subjectType,
    subjectId: route.subjectId,
    channel: isWhatsApp ? "whatsapp" : "sms",
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
        channel: isWhatsApp ? "whatsapp" : "sms",
        fromAddress: fromE164,
        providerMessageId: messageSid,
        bodyLen: body.length,
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

async function resolveInboundRoute(body: string): Promise<InboundRoute | null> {
  // Subject-code routing is the only inbound path. Caller-ID lookup
  // was removed — SMS sender IDs are trivially spoofable, and attaching
  // arbitrary inbound to a member's thread purely on a phone match
  // hands an attacker who knows (or guesses) a member's phone a
  // direct injection vector into dispatcher conversations.
  const match = SUBJECT_CODE_RE.exec(body);
  if (!match) return null;
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
    if (!q) return null;
    return {
      subjectType: "quote",
      subjectId: q.id,
      subjectCode: code,
      toUserId: q.memberUserId ?? null,
    };
  }
  if (code.startsWith("JN-")) {
    const [t] = await db
      .select({
        id: trips.id,
        memberUserId: members.userId,
      })
      .from(trips)
      .innerJoin(members, eq(members.id, trips.memberId))
      .where(eq(trips.tripCode, code));
    if (!t) return null;
    return {
      subjectType: "trip",
      subjectId: t.id,
      subjectCode: code,
      toUserId: t.memberUserId,
    };
  }
  return null;
}
