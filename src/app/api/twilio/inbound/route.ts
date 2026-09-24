import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { messages, type NewMessage } from "@/db/schema/audit";
import { emptyLegWatchlists } from "@/db/schema/empty-legs";
import { members } from "@/db/schema/members";
import { quotes } from "@/db/schema/quotes";
import { trips } from "@/db/schema/trips";
import { logAudit } from "@/lib/audit";
import { sendDispatchAlert } from "@/lib/email";
import { isTwilioConfigured, verifyTwilioSignatureAny } from "@/lib/twilio";
import { DEACTIVATED_BY_SMS_STOP, optOutKeyword } from "@/lib/sms-optout";

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

// Twilio reads the webhook response as TwiML and logs error 12300
// ("Invalid Content-Type") for anything else, JSON included. An empty
// <Response/> means "received, send nothing back"; diagnostics that used
// to ride in the JSON body live in the function log instead. Error
// statuses keep their codes so the smoke checks (403/503) still hold.
const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
function twiml(status = 200): NextResponse {
  return new NextResponse(EMPTY_TWIML, {
    status,
    headers: { "content-type": "text/xml; charset=utf-8" },
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isTwilioConfigured()) {
    return twiml(503);
  }

  const rawBody = await request.text();
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(rawBody)) {
    params[k] = v;
  }

  // Reconstruct the URL Twilio signed. Twilio signs the URL configured in
  // its console, and behind Vercel the function may see that host in
  // x-forwarded-host, in host, or in neither (a request to a deployment
  // alias reports the alias). Try every host we could plausibly have been
  // reached on; each candidate is still bound to the auth token, so this
  // widens what we accept only to URLs Twilio could actually have signed.
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const reqUrl = new URL(request.url);
  const pathAndQuery = reqUrl.pathname + reqUrl.search;
  const hosts = new Set<string>();
  for (const h of [
    request.headers.get("x-forwarded-host"),
    request.headers.get("host"),
    request.headers.get("x-vercel-deployment-url"),
    siteHost(),
  ]) {
    if (h) hosts.add(h);
  }
  const candidates = [...hosts].map((h) => `${forwardedProto}://${h}${pathAndQuery}`);

  const sig = request.headers.get("x-twilio-signature");
  if (!verifyTwilioSignatureAny(candidates, params, sig)) {
    // No secrets here: hosts tried and whether a signature arrived at all
    // is enough to tell "wrong webhook URL in the Twilio console" from
    // "wrong TWILIO_AUTH_TOKEN" when reading the function log.
    console.warn("[twilio:inbound] signature mismatch", {
      tried: [...hosts],
      path: pathAndQuery,
      signaturePresent: Boolean(sig),
    });
    return twiml(403);
  }

  const messageSid = params.MessageSid ?? "";
  const from = params.From ?? "";
  const body = (params.Body ?? "").slice(0, 4000);
  const isWhatsApp = from.startsWith("whatsapp:");
  const fromE164 = isWhatsApp ? from.slice("whatsapp:".length) : from;

  // Carrier keywords first: a STOP carries no subject code, so left to
  // the threading path below it would be logged as unmatched and lost,
  // and the empty-leg watchlist behind it would stay active.
  //
  // This path keys on the sender number alone, which the threading rules
  // above deliberately refuse to do. The difference is what a spoofed
  // number buys. Against a thread it buys injecting text a dispatcher
  // reads as the customer. Here it buys switching someone's own alerts
  // off — the direction we would take anyway if we were unsure, and the
  // same basis Twilio and the carriers use for opt-out. Honouring STOP
  // is also not optional. START is bounded to match: it resumes only
  // rows this handler paused, so the worst a spoofer achieves is
  // restoring the state that person already chose.
  const keyword = optOutKeyword(body);
  if (keyword) {
    const updated = await applyWatchlistKeyword(keyword, fromE164);
    console.log("[twilio:inbound] carrier keyword", { keyword, from: fromE164, updated });
    if (updated > 0) {
      try {
        await logAudit({
          actorUserId: null,
          actorRole: "system",
          action: `empty_leg_watchlist.sms.${keyword}`,
          subjectType: "empty_leg_watchlist",
          subjectId: null,
          metadata: { fromAddress: fromE164, providerMessageId: messageSid, updated },
        });
      } catch (err) {
        console.error("[twilio:inbound] opt-out audit failed (non-fatal)", err);
      }
    }
    // Twilio sends its own STOP/HELP confirmation; answering with our
    // own body here would double-text someone who just asked us not to.
    return twiml();
  }

  const route = await resolveInboundRoute(body);
  if (!route) {
    console.warn("[twilio:inbound] no subject code in body — forwarding to the desk as unrouted", {
      messageSid,
      from: fromE164,
      bodyPreview: body.slice(0, 80),
    });
    // ACK so Twilio doesn't retry — but forward to the desk instead of
    // losing it to a log line ("ops can grep" was the old story).
    try {
      await sendDispatchAlert({
        subject: "[UNROUTED] Inbound SMS — no [CODE] in body",
        headline: "An inbound text couldn't be threaded.",
        lines: [
          `From: ${fromE164}`,
          "— Body (untrusted, first 800 chars) —",
          body.slice(0, 800) || "(empty)",
        ],
      });
    } catch (err) {
      console.error("[twilio:inbound] unrouted forward failed (non-fatal)", err);
    }
    return twiml();
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
      console.log("[twilio:inbound] duplicate delivery ignored", { messageSid });
      return twiml();
    }
    console.error("[twilio:inbound] insert failed", err);
    return twiml(500);
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

  // Wake the desk — a threaded reply previously landed unread with
  // nothing pointing at it.
  try {
    await sendDispatchAlert({
      subject: `[${route.subjectCode}] ${isWhatsApp ? "WhatsApp" : "SMS"} reply from ${fromE164}`,
      headline: `New ${isWhatsApp ? "WhatsApp" : "SMS"} reply on ${route.subjectCode}.`,
      lines: [preview || "(empty body)"],
      link: {
        label: "Open the thread",
        url: `https://jetnine.com/admin/${route.subjectType === "quote" ? "quote" : "trip"}/${route.subjectId}`,
      },
    });
  } catch (err) {
    console.error("[twilio:inbound] desk alert failed (non-fatal)", err);
  }

  console.log("[twilio:inbound] threaded", {
    messageSid,
    subjectCode: route.subjectCode,
    messageId,
  });
  return twiml();
}

/**
 * Keep our watchlist rows in step with the carrier-level block Twilio
 * has already applied. STOP deactivates every active watchlist on that
 * number and stamps why; START resumes only the rows STOP paused, so a
 * watchlist switched off deliberately stays off. HELP changes nothing.
 *
 * Returns how many rows moved, which is what the response and the audit
 * entry report.
 */
async function applyWatchlistKeyword(
  keyword: "stop" | "start" | "help",
  fromE164: string,
): Promise<number> {
  if (keyword === "help" || !fromE164) return 0;
  try {
    if (keyword === "stop") {
      const rows = await db
        .update(emptyLegWatchlists)
        .set({
          active: false,
          deactivatedAt: new Date(),
          deactivatedReason: DEACTIVATED_BY_SMS_STOP,
        })
        .where(
          and(eq(emptyLegWatchlists.phoneE164, fromE164), eq(emptyLegWatchlists.active, true)),
        )
        .returning({ id: emptyLegWatchlists.id });
      return rows.length;
    }
    const rows = await db
      .update(emptyLegWatchlists)
      .set({ active: true, deactivatedAt: null, deactivatedReason: null })
      .where(
        and(
          eq(emptyLegWatchlists.phoneE164, fromE164),
          eq(emptyLegWatchlists.active, false),
          eq(emptyLegWatchlists.deactivatedReason, DEACTIVATED_BY_SMS_STOP),
        ),
      )
      .returning({ id: emptyLegWatchlists.id });
    return rows.length;
  } catch (err) {
    // Never fail the webhook over this — Twilio would retry, and the
    // carrier block is already in force regardless of our bookkeeping.
    console.error("[twilio:inbound] watchlist opt-out write failed", { keyword, err });
    return 0;
  }
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

  // Quote codes AND trip codes both use the JN- prefix (5- vs 4-digit
  // ordinals), so JN- must be tried against quotes first, then trips.
  if (code.startsWith("QT-") || code.startsWith("JN-")) {
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

/** Host of the canonical site URL (jetnine.com in production), or null. */
function siteHost(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).host || null;
  } catch {
    return null;
  }
}
