"use server";

import { headers } from "next/headers";
import { db } from "@/db";
import { contactInquiries } from "@/db/schema/contact";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { GUIDE_PDF_PATH, GUIDE_PDF_TITLE } from "@/lib/guide-download";
import { SITE } from "@/lib/constants";

export type GuideRequestResult =
  | { ok: true; url: string }
  | { ok: false; error: string; retryAfterMs?: number };

const GUIDE_RATE_LIMIT_MAX = 5;
const GUIDE_RATE_LIMIT_WINDOW_SECONDS = 300;

/**
 * Pricing-guide lead capture (audit item 14). Leads land in
 * contact_inquiries (reason "other", notes prefixed "Pricing guide") so
 * the desk sees them in the same queue as every other inbound — a
 * dedicated leads table can come later without changing this form.
 * On success the caller gets the download URL immediately AND we email
 * it, so the address handed over has to be real to keep the guide.
 */
export async function requestPricingGuide(formData: FormData): Promise<GuideRequestResult> {
  const field = (name: string) => ((formData.get(name) as string | null) ?? "").trim();

  const name = field("name");
  const email = field("email");
  const frequency = field("frequency"); // optional qualification select

  // Honeypot — same convention as the contact form: the visible form
  // never renders this field, so any value is a bot. Pretend success.
  if (field("company")) {
    console.warn("requestPricingGuide honeypot tripped — dropping submission");
    return { ok: true, url: GUIDE_PDF_PATH };
  }

  const errors: string[] = [];
  if (!name) errors.push("name");
  if (!email) errors.push("email");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("email-format");
  if (errors.length) return { ok: false, error: errors.join(", ").toUpperCase() };

  let clientIp = "unknown";
  try {
    const hdrs = await headers();
    clientIp = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  } catch {
    // Outside a request scope (unit tests) — proceed without limiting.
  }
  if (clientIp !== "unknown") {
    const rl = await checkRateLimit(`guide_request:${clientIp}`, {
      max: GUIDE_RATE_LIMIT_MAX,
      windowSeconds: GUIDE_RATE_LIMIT_WINDOW_SECONDS,
    });
    if (!rl.ok) return { ok: false, error: "RATE_LIMITED", retryAfterMs: rl.retryAfterMs };
  }

  const [firstName, ...rest] = name.split(/\s+/);
  const lastName = rest.join(" ") || "—";

  try {
    await db.insert(contactInquiries).values({
      reason: "other",
      firstName,
      lastName,
      email,
      notes: `Pricing guide download${frequency ? ` · flies privately: ${frequency}` : ""}`,
      status: "new",
    });
  } catch (err) {
    // The lead is the point — if it can't land, fail loudly rather than
    // silently handing out the asset with nothing captured.
    console.error("requestPricingGuide insert failed", err);
    return { ok: false, error: "DB_INSERT_FAILED" };
  }

  // Best-effort email with the link (Resend/Postmark when configured,
  // logger in dev). A send failure never blocks the download the page
  // already returned.
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");
  const url = `${base}${GUIDE_PDF_PATH}`;
  try {
    await sendEmail({
      to: email,
      subject: `${GUIDE_PDF_TITLE} — your download`,
      text: `Here's your copy of ${GUIDE_PDF_TITLE}:\n\n${url}\n\nEvery chapter is also open at ${base}/guides. Questions? The dispatch desk answers around the clock: ${SITE.dispatchPhone}.\n\n— JetNine dispatch`,
      html: [
        `<p style="margin:0 0 16px;font-size:15px;color:#0F1115;">Here's your copy of <strong>${GUIDE_PDF_TITLE}</strong>:</p>`,
        `<p style="margin:0 0 16px;"><a href="${url}" style="color:#0F1115;font-weight:600;">Download the guide (PDF)</a></p>`,
        `<p style="margin:0 0 16px;font-size:13px;color:#6B7280;">Every chapter is also open at <a href="${base}/guides" style="color:#0F1115;">jetnine.com/guides</a> — no form needed there. Rates are reviewed quarterly; the guide notes its edition date.</p>`,
        `<p style="margin:0;font-size:12px;color:#6B7280;">JetNine dispatch · <a href="tel:${SITE.dispatchPhoneE164}" style="color:#0F1115;">${SITE.dispatchPhone}</a> · 24/7</p>`,
      ].join(""),
    });
  } catch (err) {
    console.error("requestPricingGuide email send failed", err);
  }

  return { ok: true, url: GUIDE_PDF_PATH };
}
