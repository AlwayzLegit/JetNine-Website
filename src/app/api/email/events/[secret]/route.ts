import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { messages } from "@/db/schema/audit";
import { logAudit } from "@/lib/audit";
import { sendDispatchAlert } from "@/lib/email";

// Resend delivery-event webhook (email.bounced / email.complained).
//
// Until this existed, `delivery_status: "sent"` meant "the API accepted
// it", never "it landed" — a member whose address hard-bounced kept
// getting green-pill trip alerts forever. Resend POSTs here on bounce/
// complaint; we downgrade the matching outbound message to `failed`
// (with the reason) and page the desk so a dead address gets a phone
// call instead of more email.
//
// IMPORTANT — shared account: the Resend account also sends for two
// unrelated businesses, and webhooks are account-wide. Events whose
// email_id doesn't match one of OUR messages rows are acknowledged and
// silently ignored (they're the other businesses' traffic, not ours).
//
// Auth: path secret compared in constant time against RESEND_EVENTS_SECRET
// (same capability-URL pattern as the Postmark inbound route). Fail closed.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ResendEvent = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    subject?: string;
    bounce?: { message?: string; subType?: string; type?: string };
  };
};

function authorized(secretParam: string): boolean {
  const secret = process.env.RESEND_EVENTS_SECRET;
  if (!secret) return false;
  const a = Buffer.from(secretParam, "utf8");
  const b = Buffer.from(secret, "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ secret: string }> },
): Promise<NextResponse> {
  const { secret } = await params;
  if (!authorized(secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let event: ResendEvent;
  try {
    event = (await request.json()) as ResendEvent;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const type = event.type ?? "";
  if (type !== "email.bounced" && type !== "email.complained") {
    return NextResponse.json({ received: true, ignored: type || "unknown" });
  }

  const emailId = event.data?.email_id;
  if (!emailId) return NextResponse.json({ received: true, ignored: "no email_id" });

  const reason =
    type === "email.complained"
      ? "recipient marked the email as spam"
      : (event.data?.bounce?.message ?? "hard bounce").slice(0, 400);

  // Downgrade the matching outbound message. No match = another business's
  // traffic on the shared account — ack and move on.
  const updated = await db
    .update(messages)
    .set({
      deliveryStatus: "failed",
      deliveryError: `${type}: ${reason}`.slice(0, 500),
    })
    .where(eq(messages.deliveryMessageId, emailId))
    .returning({
      id: messages.id,
      subjectType: messages.subjectType,
      subjectId: messages.subjectId,
      toAddress: messages.toAddress,
      preview: messages.preview,
    });
  if (updated.length === 0) {
    return NextResponse.json({ received: true, unmatched: true });
  }

  const m = updated[0];
  try {
    await logAudit({
      actorUserId: null,
      actorRole: "system",
      action: `message.delivery.${type === "email.complained" ? "complaint" : "bounce"}`,
      subjectType: m.subjectType,
      subjectId: m.subjectId,
      metadata: { messageId: m.id, to: m.toAddress, emailId, reason },
    });
  } catch (err) {
    console.error("[resend-events] audit failed (non-fatal)", err);
  }

  try {
    const threadPath = m.subjectType === "quote" ? "quote" : m.subjectType === "trip" ? "trip" : null;
    await sendDispatchAlert({
      subject: `[EMAIL ${type === "email.complained" ? "COMPLAINT" : "BOUNCE"}] ${m.toAddress ?? "unknown address"}`,
      headline:
        type === "email.complained"
          ? "A customer marked our email as spam."
          : "An email to a customer bounced.",
      lines: [
        `Address: ${m.toAddress ?? "unknown"}`,
        `Message: ${m.preview ?? "—"}`,
        `Why: ${reason}`,
        type === "email.complained"
          ? "Stop emailing this address — call instead, and check what triggered the complaint."
          : "The address looks dead — reach the customer another way and fix the record.",
      ],
      link:
        threadPath && m.subjectId
          ? { label: "Open the thread", url: `https://jetnine.com/admin/${threadPath}/${m.subjectId}` }
          : undefined,
    });
  } catch (err) {
    console.error("[resend-events] desk alert failed (non-fatal)", err);
  }

  return NextResponse.json({ received: true, messageId: m.id });
}
