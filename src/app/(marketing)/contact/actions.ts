"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  contactInquiries,
  contactReasonEnum,
  type NewContactInquiry,
} from "@/db/schema/contact";
import { getCurrentUser } from "@/lib/auth";
import { getMemberByUserId } from "@/lib/member";
import { logAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendDispatchContactNotification } from "@/lib/email";

export type ContactResult =
  | { ok: true; message: string }
  | { ok: false; error: string; retryAfterMs?: number };

// Mirrors the quote-wizard limiter: generous for a human re-sending after
// a typo, tight enough that a form bot can't flood the dispatch inbox.
const CONTACT_RATE_LIMIT_MAX = 5;
const CONTACT_RATE_LIMIT_WINDOW_SECONDS = 300;

type Reason = (typeof contactReasonEnum.enumValues)[number];

function isReason(s: string): s is Reason {
  return (contactReasonEnum.enumValues as readonly string[]).includes(s);
}

export async function submitContactInquiry(formData: FormData): Promise<ContactResult> {
  const field = (name: string) => ((formData.get(name) as string | null) ?? "").trim();

  const firstName = field("first");
  const lastName = field("last");
  const email = field("email");
  const mobile = field("mobile");
  const reasonRaw = field("reason");
  const fromText = field("from");
  const toText = field("to");
  const dateText = field("date");
  const paxText = field("pax");
  const notes = field("notes");

  // Server-side validation — the client repeats this for fast feedback,
  // but never gets trusted.
  const errors: string[] = [];
  if (!firstName) errors.push("first");
  if (!lastName) errors.push("last");
  if (!email) errors.push("email");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("email-format");
  if (!fromText) errors.push("from");
  if (!toText) errors.push("to");
  if (!dateText) errors.push("date");
  if (notes.length > 2000) errors.push("notes-too-long");
  if (errors.length) {
    return { ok: false, error: errors.join(", ").toUpperCase() };
  }

  const reason: Reason = isReason(reasonRaw) ? reasonRaw : "other";

  let clientIp = "unknown";
  try {
    const hdrs = await headers();
    clientIp = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  } catch {
    // headers() can throw outside a request scope (unit tests); proceed
    // without rate-limiting in that case.
  }

  if (clientIp !== "unknown") {
    const rl = await checkRateLimit(`contact_submit:${clientIp}`, {
      max: CONTACT_RATE_LIMIT_MAX,
      windowSeconds: CONTACT_RATE_LIMIT_WINDOW_SECONDS,
    });
    if (!rl.ok) {
      return { ok: false, error: "RATE_LIMITED", retryAfterMs: rl.retryAfterMs };
    }
  }

  // Same [SMOKE] convention as the quote wizard: the prod-smoke suite
  // submits through the real form, the row lands pre-handled so it never
  // shows on the desk, and no email fires.
  const isSmoke = firstName.startsWith("[SMOKE]");

  // Link the member profile when the visitor is signed in. Auth lookup
  // failure (e.g. Supabase unreachable in CI) degrades to anonymous —
  // the inquiry still lands.
  let memberId: string | null = null;
  let user: Awaited<ReturnType<typeof getCurrentUser>> = null;
  try {
    user = await getCurrentUser();
    if (user) {
      const m = await getMemberByUserId(user.id);
      memberId = m?.id ?? null;
    }
  } catch (err) {
    console.error("submitContactInquiry auth lookup failed — treating as anon", err);
  }

  const values: NewContactInquiry = {
    reason,
    firstName,
    lastName,
    email,
    phone: mobile || null,
    fromText: fromText || null,
    toText: toText || null,
    dateText: dateText || null,
    paxText: paxText || null,
    notes: notes || null,
    memberId,
    status: isSmoke ? "handled" : "new",
  };

  let insertedId: string;
  try {
    const [row] = await db
      .insert(contactInquiries)
      .values(values)
      .returning({ id: contactInquiries.id });
    insertedId = row.id;
  } catch (err) {
    console.error("submitContactInquiry failed", err);
    return { ok: false, error: "DB_INSERT_FAILED" };
  }

  await logAudit({
    actorUserId: user?.id ?? null,
    actorRole: user?.role ?? "anon",
    action: "contact_inquiry.submit",
    subjectType: "contact_inquiry",
    subjectId: insertedId,
    metadata: {
      reason,
      contactEmail: email,
      fromText: fromText || null,
      toText: toText || null,
      smoke: isSmoke || undefined,
    },
  });

  revalidatePath("/admin/inquiries");

  if (isSmoke) {
    return { ok: true, message: "DISPATCH WILL REPLY WITHIN 30 MIN" };
  }

  // Fire-and-forget — never block the visitor's submit on SMTP. The email
  // layer no-ops gracefully (logger mode) without a provider key.
  try {
    const hdrs = await headers();
    const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost:3000";
    const proto =
      hdrs.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`;

    const result = await sendDispatchContactNotification({
      inquiryId: insertedId,
      reason,
      firstName,
      lastName,
      email,
      phone: mobile || null,
      fromText: fromText || null,
      toText: toText || null,
      dateText: dateText || null,
      paxText: paxText || null,
      notes: notes || null,
      inquiriesUrl: `${baseUrl}/admin/inquiries`,
    });

    await logAudit({
      actorUserId: null,
      actorRole: "system",
      action: "contact_inquiry.notify.email",
      subjectType: "contact_inquiry",
      subjectId: insertedId,
      metadata: result.ok
        ? { status: "ok", provider: result.provider, messageId: result.messageId ?? null }
        : { status: "error", error: result.error },
    });
  } catch (err) {
    console.error("submitContactInquiry email side-effect failed", err);
  }

  return { ok: true, message: "DISPATCH WILL REPLY WITHIN 30 MIN" };
}
