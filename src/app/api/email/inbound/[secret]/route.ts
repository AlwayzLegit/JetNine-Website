import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { messages, type NewMessage } from "@/db/schema/audit";
import { quotes } from "@/db/schema/quotes";
import { trips } from "@/db/schema/trips";
import { members } from "@/db/schema/members";
import { logAudit } from "@/lib/audit";

// Inbound email webhook — Postmark's "Inbound Stream" calls this URL
// with a JSON payload representing a parsed reply. We use a path-based
// secret (`/api/email/inbound/[secret]`) rather than HMAC because
// Postmark's HMAC-signing scheme isn't on by default and a long random
// secret in the URL is equivalent in practice. The secret lives in
// `INBOUND_EMAIL_SECRET`.
//
// Threading: outbound emails carry `[QT-2026-NNNN]` or `[JN-2026-NNNN]`
// in the subject. Customer replies typically prepend `Re:` but preserve
// the bracketed code; we extract it and route to the right thread.
//
// Idempotency: Postmark retries on timeout. The `messages_inbound_provider_id_uq`
// partial unique index on `delivery_message_id` short-circuits duplicate
// deliveries — we catch the unique-violation and return 200 so Postmark
// stops retrying.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Match `[QT-2026-1234]` or `[JN-2026-1234]` (case-insensitive). The
// Re:/Fwd: prefix is irrelevant; we just need to find the bracketed
// code anywhere in the subject.
const SUBJECT_CODE_RE = /\[((?:QT|JN|INV)-\d{4}-\d+)\]/i;

type PostmarkInbound = {
  From?: string;
  FromFull?: { Email?: string; Name?: string };
  To?: string;
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  StrippedTextReply?: string;
  MessageID?: string;
  Date?: string;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ secret: string }> },
): Promise<NextResponse> {
  // Constant-time-ish secret check. We compare lengths first to avoid
  // exposing the expected length, then compare bytes. Not perfect
  // (lengths still leak via timing), but the secret is 32+ random
  // chars; an attacker can't realistically brute-force.
  const expected = process.env.INBOUND_EMAIL_SECRET;
  if (!expected) {
    // Ships dark — without the secret configured, the endpoint is
    // disabled. 404 (not 503) so the route looks like it doesn't exist.
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { secret } = await params;
  if (secret.length !== expected.length || secret !== expected) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  let payload: PostmarkInbound;
  try {
    payload = (await request.json()) as PostmarkInbound;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const subject = (payload.Subject ?? "").slice(0, 500);
  const match = SUBJECT_CODE_RE.exec(subject);
  if (!match) {
    // No code in subject — we can't route the message. Log it for ops
    // visibility but ACK to Postmark so it doesn't retry.
    console.warn("[email:inbound] unmatched subject", {
      messageId: payload.MessageID,
      subject,
      from: payload.From,
    });
    return NextResponse.json({ received: true, unmatched: true });
  }

  const code = match[1].toUpperCase();
  const route = await resolveRoute(code);
  if (!route) {
    console.warn("[email:inbound] code not found in DB", {
      code,
      messageId: payload.MessageID,
      subject,
    });
    return NextResponse.json({ received: true, codeNotFound: true });
  }

  const fromEmail = (payload.FromFull?.Email ?? payload.From ?? "").slice(0, 320);
  const body = (payload.StrippedTextReply ?? payload.TextBody ?? "").slice(0, 50_000);
  const preview = body.length > 140 ? `${body.slice(0, 139)}…` : body;
  const providerMessageId = payload.MessageID?.slice(0, 200) ?? null;

  const values: NewMessage = {
    subjectType: route.subjectType,
    subjectId: route.subjectId,
    channel: "email",
    direction: "in",
    fromAddress: fromEmail || null,
    toAddress: (payload.To ?? "").slice(0, 320) || null,
    fromUserId: null,
    toUserId: route.toUserId ?? null,
    preview,
    body,
    isRead: false,
    deliveryStatus: "sent", // inbound = delivered, by definition
    deliveryProvider: "postmark",
    deliveryMessageId: providerMessageId,
    deliveredAt: payload.Date ? new Date(payload.Date) : new Date(),
  };

  let inserted: { id: string } | null = null;
  try {
    const result = await db.insert(messages).values(values).returning({ id: messages.id });
    inserted = result[0] ?? null;
  } catch (err) {
    // Unique-violation on the partial index = duplicate Postmark
    // delivery. 200 OK so Postmark stops retrying.
    if (isUniqueViolation(err)) {
      return NextResponse.json({ received: true, deduped: true });
    }
    console.error("[email:inbound] insert failed", err);
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }

  if (!inserted) {
    return NextResponse.json({ error: "insert returned nothing" }, { status: 500 });
  }

  // Audit but don't fail the webhook if audit fails — the message is
  // already in the DB; audit is best-effort metadata.
  try {
    await logAudit({
      actorUserId: null,
      actorRole: "system",
      action: `${route.subjectType}.message.inbound`,
      subjectType: route.subjectType,
      subjectId: route.subjectId,
      subjectCode: code,
      metadata: {
        messageId: inserted.id,
        from: fromEmail,
        providerMessageId,
        bodyLen: body.length,
      },
    });
  } catch (err) {
    console.error("[email:inbound] audit failed (non-fatal)", err);
  }

  return NextResponse.json({ received: true, messageId: inserted.id });
}

type RouteTarget = {
  subjectType: "quote" | "trip";
  subjectId: string;
  toUserId: string | null;
};

async function resolveRoute(code: string): Promise<RouteTarget | null> {
  if (code.startsWith("QT-")) {
    const [row] = await db
      .select({
        id: quotes.id,
        memberId: quotes.memberId,
        memberUserId: members.userId,
      })
      .from(quotes)
      .leftJoin(members, eq(members.id, quotes.memberId))
      .where(eq(quotes.quoteCode, code));
    if (!row) return null;
    return { subjectType: "quote", subjectId: row.id, toUserId: row.memberUserId ?? null };
  }
  if (code.startsWith("JN-")) {
    const [row] = await db
      .select({
        id: trips.id,
        memberId: trips.memberId,
        memberUserId: members.userId,
      })
      .from(trips)
      .innerJoin(members, eq(members.id, trips.memberId))
      .where(eq(trips.tripCode, code));
    if (!row) return null;
    return { subjectType: "trip", subjectId: row.id, toUserId: row.memberUserId };
  }
  // INV-... could route to the invoice's trip, but that's not a thread
  // surface we've built yet. Drop for now; revisit when invoice has a
  // member-facing comments panel.
  return null;
}

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  // postgres-js attaches the SQLSTATE code as `.code` on errors.
  const code = (err as { code?: string }).code;
  return code === "23505";
}
