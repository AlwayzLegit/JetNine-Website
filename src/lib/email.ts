/**
 * Provider-agnostic transactional-email layer. Designed to ship dark.
 *
 * When neither RESEND_API_KEY nor POSTMARK_SERVER_TOKEN is set, every call
 * logs the payload to stdout and resolves successfully — so the rest of the
 * app behaves as if email were wired even on a fresh clone. The moment a
 * key lands in env, the same callsites start delivering.
 *
 * Deliberate non-features:
 * - No templating engine. Markup is inline so it stays one file to read
 *   when debugging a delivery issue from a Vercel function log.
 * - No queue. Calls are best-effort; the caller wraps in try/catch and
 *   never blocks the user-facing action on delivery failure.
 * - No SDK. Both providers expose a simple HTTPS shape; raw fetch keeps
 *   bundle size flat and makes provider-swap trivial.
 */

import { SITE } from "@/lib/constants";

type EmailPayload = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  // For Postmark stream routing; default "outbound".
  stream?: string;
};

type SendResult =
  | { ok: true; provider: "resend" | "postmark" | "logger"; messageId?: string }
  | { ok: false; error: string };

const RESEND_KEY = process.env.RESEND_API_KEY;
const POSTMARK_TOKEN = process.env.POSTMARK_SERVER_TOKEN;
const HAS_PROVIDER = Boolean(RESEND_KEY || POSTMARK_TOKEN);

// EMAIL_FROM is required the moment a provider key is set — without it,
// deliveries would go from "ships dark" to "ships from an undefined
// sender." Fail loudly at module load so a misconfigured Vercel deploy
// surfaces in the build logs instead of silently delivering with a
// placeholder address. In logger mode (no provider key), the placeholder
// is fine since nothing actually leaves the process.
const FROM_RAW = process.env.EMAIL_FROM;
if (HAS_PROVIDER && !FROM_RAW) {
  throw new Error(
    "EMAIL_FROM is required when RESEND_API_KEY or POSTMARK_SERVER_TOKEN is set. " +
      "Set it to a verified sender, e.g. 'JetNine <dispatch@jetnine.com>'.",
  );
}
const FROM = FROM_RAW || "JetNine <dispatch@jetnine.com>";

function pickProvider(): "resend" | "postmark" | "logger" {
  if (RESEND_KEY) return "resend";
  if (POSTMARK_TOKEN) return "postmark";
  return "logger";
}

export async function sendEmail(payload: EmailPayload): Promise<SendResult> {
  const provider = pickProvider();

  if (provider === "logger") {
    // Dev / unconfigured path — write the would-be email to stdout so the
    // developer can verify content from `pnpm dev` or Vercel function logs.
    const recipients = Array.isArray(payload.to) ? payload.to.join(", ") : payload.to;
    console.log("[email:dry-run]", {
      to: recipients,
      subject: payload.subject,
      from: FROM,
      // Truncate body so the log line stays scannable.
      textPreview: payload.text?.slice(0, 200) ?? payload.html.slice(0, 200),
    });
    return { ok: true, provider: "logger" };
  }

  if (provider === "resend") {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_KEY}`,
        },
        body: JSON.stringify({
          from: FROM,
          to: Array.isArray(payload.to) ? payload.to : [payload.to],
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
          reply_to: payload.replyTo,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return { ok: false, error: `resend ${res.status}: ${body.slice(0, 200)}` };
      }
      const json = (await res.json().catch(() => ({}))) as { id?: string };
      return { ok: true, provider: "resend", messageId: json.id };
    } catch (err) {
      return { ok: false, error: `resend fetch failed: ${String(err)}` };
    }
  }

  // Postmark
  try {
    const recipients = Array.isArray(payload.to) ? payload.to.join(", ") : payload.to;
    const res = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Postmark-Server-Token": POSTMARK_TOKEN!,
      },
      body: JSON.stringify({
        From: FROM,
        To: recipients,
        Subject: payload.subject,
        HtmlBody: payload.html,
        TextBody: payload.text,
        ReplyTo: payload.replyTo,
        MessageStream: payload.stream ?? "outbound",
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `postmark ${res.status}: ${body.slice(0, 200)}` };
    }
    const json = (await res.json().catch(() => ({}))) as { MessageID?: string };
    return { ok: true, provider: "postmark", messageId: json.MessageID };
  } catch (err) {
    return { ok: false, error: `postmark fetch failed: ${String(err)}` };
  }
}

// ─── Domain senders ────────────────────────────────────────────
// Each helper composes a specific message and calls sendEmail. Keeping the
// HTML inline (with text fallback) is intentional — when an email fails to
// render right in a customer's mail client, you read the page and you read
// the function side-by-side, not the page and a templating layer.

const DISPATCH_NOTIFY =
  process.env.DISPATCH_NOTIFY_EMAIL ||
  process.env.NEXT_PUBLIC_DISPATCH_EMAIL ||
  "dispatch@jetnine.com";

type QuoteSubmittedContext = {
  quoteCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  legs: { fromIata: string | null; toIata: string | null; date: string | null }[];
  paxCount: number;
};

export async function sendQuoteAcknowledgmentEmail(
  ctx: QuoteSubmittedContext,
): Promise<SendResult> {
  const fullName = `${ctx.firstName} ${ctx.lastName}`.trim();
  const route = ctx.legs
    .map((l) => `${l.fromIata ?? "—"} → ${l.toIata ?? "—"}`)
    .join(", ");

  const subject = `${ctx.quoteCode} — your JetNine quote request`;
  const text = [
    `${fullName},`,
    ``,
    `We've received your charter request. A dispatcher is on it — you'll have options back within 30 minutes during operational hours, sooner if you marked it urgent.`,
    ``,
    `Reference:  ${ctx.quoteCode}`,
    `Route:      ${route}`,
    `Pax:        ${ctx.paxCount}`,
    ``,
    `If you need to reach us sooner: dispatch is on ${SITE.dispatchPhone}, 24/7.`,
    ``,
    `JetNine LLC · 14 CFR Part 295 indirect air carrier · all flights operated by an FAA Part 135 direct air carrier.`,
  ].join("\n");

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;color:#0F1115;line-height:1.55;max-width:560px;margin:0 auto;padding:24px;">
      <p style="margin:0 0 16px;font-size:14px;letter-spacing:0.12em;text-transform:uppercase;color:#6B7280;">— ${ctx.quoteCode}</p>
      <h1 style="margin:0 0 24px;font-family:'Fraunces',Georgia,serif;font-weight:300;font-size:32px;letter-spacing:-0.01em;">
        ${escapeHtml(fullName)} — we&rsquo;ve got it.
      </h1>
      <p style="margin:0 0 16px;font-size:15px;">
        A dispatcher is sourcing options now. You&rsquo;ll have a reply within
        <strong>30 minutes</strong> during operational hours, sooner if it&rsquo;s urgent.
      </p>
      <table style="margin:24px 0;border-collapse:collapse;font-size:13px;">
        <tr><td style="padding:4px 16px 4px 0;color:#6B7280;text-transform:uppercase;letter-spacing:0.08em;font-size:11px;">Route</td><td style="padding:4px 0;">${escapeHtml(route)}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#6B7280;text-transform:uppercase;letter-spacing:0.08em;font-size:11px;">Pax</td><td style="padding:4px 0;">${ctx.paxCount}</td></tr>
      </table>
      <p style="margin:24px 0 8px;font-size:13px;color:#6B7280;">Need us sooner?</p>
      <p style="margin:0;font-size:14px;"><a href="tel:${SITE.dispatchPhoneE164}" style="color:#0F1115;">${SITE.dispatchPhone}</a> · 24/7</p>
      <p style="margin:40px 0 0;font-size:11px;color:#9CA3AF;line-height:1.6;">
        JetNine LLC · 14 CFR Part 295 indirect air carrier. All flights operated by an FAA Part 135 direct air carrier.
      </p>
    </div>
  `.trim();

  return sendEmail({
    to: ctx.email,
    subject,
    html,
    text,
    replyTo: DISPATCH_NOTIFY,
  });
}

export async function sendDispatchNewQuoteNotification(
  ctx: QuoteSubmittedContext & { workbenchUrl: string },
): Promise<SendResult> {
  const fullName = `${ctx.firstName} ${ctx.lastName}`.trim();
  const route = ctx.legs
    .map((l) => `${l.fromIata ?? "—"} → ${l.toIata ?? "—"} (${l.date ?? "—"})`)
    .join("\n           ");

  const subject = `[NEW] ${ctx.quoteCode} · ${fullName} · ${ctx.legs.length} leg${ctx.legs.length === 1 ? "" : "s"}`;
  const text = [
    `New quote on the desk:`,
    ``,
    `Ref:       ${ctx.quoteCode}`,
    `Contact:   ${fullName}`,
    `Email:     ${ctx.email}`,
    `Phone:     ${ctx.phone ?? "—"}`,
    `Pax:       ${ctx.paxCount}`,
    `Route(s):  ${route}`,
    ``,
    `Workbench: ${ctx.workbenchUrl}`,
    ``,
    `SLA clock starts now — 30 minutes to first reply.`,
  ].join("\n");

  const html = `
    <div style="font-family:'JetBrains Mono',ui-monospace,SF Mono,Menlo,Consolas,monospace;color:#0F1115;line-height:1.55;max-width:600px;margin:0 auto;padding:24px;">
      <p style="margin:0 0 16px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#0F1115;">— NEW QUOTE · ${ctx.quoteCode}</p>
      <h2 style="margin:0 0 16px;font-family:'Fraunces',Georgia,serif;font-weight:300;font-size:24px;letter-spacing:-0.01em;font-family-feature-settings:'ss01';">
        ${escapeHtml(fullName)} · ${ctx.paxCount} pax · ${ctx.legs.length} leg${ctx.legs.length === 1 ? "" : "s"}
      </h2>
      <pre style="margin:0 0 16px;padding:12px;background:#F5F4F0;border-left:2px solid #C5CDD9;font-size:12px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(text)}</pre>
      <p style="margin:24px 0 0;font-size:14px;">
        <a href="${escapeHtml(ctx.workbenchUrl)}" style="display:inline-block;padding:10px 16px;background:#0F1115;color:#F5F4F0;text-decoration:none;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Open workbench →</a>
      </p>
    </div>
  `.trim();

  return sendEmail({
    to: DISPATCH_NOTIFY,
    subject,
    html,
    text,
    replyTo: ctx.email,
  });
}

type ContactInquiryContext = {
  inquiryId: string;
  reason: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  fromText?: string | null;
  toText?: string | null;
  dateText?: string | null;
  paxText?: string | null;
  notes?: string | null;
  inquiriesUrl: string;
};

/**
 * Desk ping for a public contact-form submission. Single recipient
 * (dispatch), replyTo = the visitor so a dispatcher can answer straight
 * from their mail client without copy-pasting the address.
 */
export async function sendDispatchContactNotification(
  ctx: ContactInquiryContext,
): Promise<SendResult> {
  const fullName = `${ctx.firstName} ${ctx.lastName}`.trim();
  const route =
    ctx.fromText || ctx.toText ? `${ctx.fromText ?? "—"} → ${ctx.toText ?? "—"}` : "—";

  const subject = `[CONTACT] ${fullName} · ${ctx.reason.toUpperCase()}`;
  const text = [
    `New contact-form inquiry:`,
    ``,
    `Reason:    ${ctx.reason}`,
    `Contact:   ${fullName}`,
    `Email:     ${ctx.email}`,
    `Phone:     ${ctx.phone ?? "—"}`,
    `Route:     ${route}`,
    `Date:      ${ctx.dateText ?? "—"}`,
    `Pax:       ${ctx.paxText ?? "—"}`,
    ctx.notes ? `\nNotes:\n${ctx.notes}` : ``,
    ``,
    `Inquiries board: ${ctx.inquiriesUrl}`,
    ``,
    `Form promises a reply within 30 minutes during business hours.`,
  ].join("\n");

  const html = `
    <div style="font-family:'JetBrains Mono',ui-monospace,SF Mono,Menlo,Consolas,monospace;color:#0F1115;line-height:1.55;max-width:600px;margin:0 auto;padding:24px;">
      <p style="margin:0 0 16px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#0F1115;">— CONTACT FORM · ${escapeHtml(ctx.reason.toUpperCase())}</p>
      <h2 style="margin:0 0 16px;font-family:'Fraunces',Georgia,serif;font-weight:300;font-size:24px;letter-spacing:-0.01em;">
        ${escapeHtml(fullName)}
      </h2>
      <pre style="margin:0 0 16px;padding:12px;background:#F5F4F0;border-left:2px solid #C5CDD9;font-size:12px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(text)}</pre>
      <p style="margin:24px 0 0;font-size:14px;">
        <a href="${escapeHtml(ctx.inquiriesUrl)}" style="display:inline-block;padding:10px 16px;background:#0F1115;color:#F5F4F0;text-decoration:none;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Open inquiries →</a>
      </p>
    </div>
  `.trim();

  return sendEmail({
    to: DISPATCH_NOTIFY,
    subject,
    html,
    text,
    replyTo: ctx.email,
  });
}

/**
 * Send a dispatcher-authored thread message as email. The subject line
 * carries the entity code (QT-/JN-/INV-) so the customer's mail client
 * threads it consistently. replyTo = dispatch desk so customer replies
 * land back with us, not in the void.
 *
 * The body comes from the dispatcher's plain-text composer. We wrap it
 * in a minimal HTML shell to preserve line breaks and keep the styling
 * recognisably JetNine without going full marketing-email theatre.
 */
export type ThreadEmailContext = {
  to: string;
  subjectCode: string; // QT-2026-1234, JN-2026-1234, etc.
  subjectSummary?: string; // short summary, appears after the code
  body: string; // plain text from the composer
  fromName?: string; // dispatcher name, optional
};

export async function sendThreadMessageEmail(ctx: ThreadEmailContext): Promise<SendResult> {
  const subject = ctx.subjectSummary
    ? `[${ctx.subjectCode}] ${ctx.subjectSummary}`
    : `[${ctx.subjectCode}] JetNine dispatch`;

  const signature = ctx.fromName ? `${ctx.fromName} · JetNine dispatch` : "JetNine dispatch";
  const text = [ctx.body, "", "—", signature, `${SITE.dispatchPhone} · 24/7`].join("\n");

  // Preserve dispatcher's line breaks. Wrap each non-empty line; render
  // blank lines as a small vertical gap.
  const bodyHtml = ctx.body
    .split("\n")
    .map((line) =>
      line.trim().length === 0
        ? `<p style="margin:0 0 12px;height:8px;"></p>`
        : `<p style="margin:0 0 12px;">${escapeHtml(line)}</p>`,
    )
    .join("");

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;color:#0F1115;line-height:1.55;max-width:560px;margin:0 auto;padding:24px;">
      <p style="margin:0 0 16px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#6B7280;">— ${escapeHtml(ctx.subjectCode)}</p>
      <div style="font-size:15px;">${bodyHtml}</div>
      <hr style="margin:32px 0 16px;border:none;border-top:1px solid #E5E7EB;"/>
      <p style="margin:0;font-size:12px;color:#6B7280;">
        ${escapeHtml(signature)}<br/>
        <a href="tel:${SITE.dispatchPhoneE164}" style="color:#0F1115;">${SITE.dispatchPhone}</a> · 24/7
      </p>
      <p style="margin:24px 0 0;font-size:10px;color:#9CA3AF;line-height:1.6;">
        JetNine LLC · 14 CFR Part 295 indirect air carrier.
      </p>
    </div>
  `.trim();

  return sendEmail({
    to: ctx.to,
    subject,
    html,
    text,
    replyTo: DISPATCH_NOTIFY,
  });
}

// ─── Trip-status auto-notifications ──────────────────────────────────
// Fired automatically by updateTripStatus when the dispatcher flips a
// trip to a customer-visible state. Each state owns its own subject +
// body so the customer's mail client doesn't show "Trip update" 4 times
// in a row — they see "Confirmed", "Boarding now", "Cancelled (wx)",
// "Trip complete". The thread bracket [JN-2026-NNNN] still threads
// them together.

export type TripNotifyStatus =
  | "confirmed"
  | "boarding"
  | "completed"
  | "cancelled_wx"
  | "cancelled_other"
  | "diverted"
  | "irregular_ops";

// Statuses we actually email on are exactly the keys of STATUS_TEMPLATES
// (defined below). Other enum values (draft, crew_briefed, airborne,
// wheels_down) are operational and don't need a customer ping. Checking
// `s in STATUS_TEMPLATES` keeps the membership in one place.
export function isNotifiableTripStatus(s: string): s is TripNotifyStatus {
  return Object.prototype.hasOwnProperty.call(STATUS_TEMPLATES, s);
}

type TripStatusContext = {
  to: string;
  tripCode: string;
  status: TripNotifyStatus;
  firstName?: string | null;
  // Itinerary summary lines, e.g. ["KLAX → KSFO · 2026-06-12 · 4 pax"].
  itineraryLines?: string[];
  // Optional free-form note from dispatcher (cancellation reason,
  // divert destination, etc). Already plain-text from the action.
  note?: string | null;
};

type StatusTemplate = {
  subjectSuffix: string;
  headline: string;
  intro: string;
};

const STATUS_TEMPLATES: Record<TripNotifyStatus, StatusTemplate> = {
  confirmed: {
    subjectSuffix: "Trip confirmed",
    headline: "You're on the manifest.",
    intro:
      "Your trip is locked in. We'll send another note when the aircraft is ready to board — usually about 30 minutes before departure.",
  },
  boarding: {
    subjectSuffix: "Boarding now",
    headline: "The aircraft is ready when you are.",
    intro:
      "Captain and crew are on board. Head to the FBO whenever you're ready; if you're already there, we'll see you on the ramp.",
  },
  completed: {
    subjectSuffix: "Trip complete",
    headline: "Wheels down. Hope it flew well.",
    intro:
      "That's a wrap on this one. A receipt + post-flight summary will land in your inbox shortly. If anything was off — or off-the-charts — we want to hear about it.",
  },
  cancelled_wx: {
    subjectSuffix: "Cancelled — weather",
    headline: "Weather got in the way.",
    intro:
      "We're standing down on this flight because of conditions we can't safely operate through. A dispatcher will follow up about reschedule options; if you want to talk through it now, dispatch is on the line below.",
  },
  cancelled_other: {
    subjectSuffix: "Cancelled",
    headline: "We've stood this one down.",
    intro:
      "This trip has been cancelled. A dispatcher will reach out about rebooking. The number below is the fastest path if you'd like to talk now.",
  },
  diverted: {
    subjectSuffix: "Diverted",
    headline: "We're putting down somewhere else.",
    intro:
      "Conditions ahead made the original destination a no-go, so we're diverting. A dispatcher is arranging ground from the new airport; expect a call within minutes.",
  },
  irregular_ops: {
    subjectSuffix: "Irregular ops",
    headline: "We've hit a snag — and we're on it.",
    intro:
      "Something operational has shifted on this trip. Don't act on it from your end yet; a dispatcher is calling you now with the live picture.",
  },
};

/**
 * Send a trip-status notification email to the member. Returns the
 * same SendResult shape as sendEmail so callers can stamp delivery
 * status on the corresponding messages row.
 */
export async function sendTripStatusEmail(ctx: TripStatusContext): Promise<SendResult> {
  const tpl = STATUS_TEMPLATES[ctx.status];
  const subject = `[${ctx.tripCode}] ${tpl.subjectSuffix}`;
  const greetingName = ctx.firstName?.trim() || "there";

  const itineraryText = ctx.itineraryLines?.length
    ? `\n\nItinerary:\n  ${ctx.itineraryLines.join("\n  ")}\n`
    : "";
  const noteText = ctx.note ? `\n\n${ctx.note}\n` : "";

  const text = [
    `${greetingName},`,
    ``,
    tpl.intro,
    itineraryText,
    noteText,
    `Reference: ${ctx.tripCode}`,
    ``,
    `Dispatch is on ${SITE.dispatchPhone}, 24/7.`,
    ``,
    `JetNine LLC · 14 CFR Part 295 indirect air carrier.`,
  ].join("\n");

  const itineraryHtml = ctx.itineraryLines?.length
    ? `<ul style="margin:16px 0;padding:0;list-style:none;">${ctx.itineraryLines
        .map(
          (l) =>
            `<li style="margin:0 0 6px;font-family:ui-monospace,SF Mono,Menlo,monospace;font-size:12px;color:#0F1115;">${escapeHtml(l)}</li>`,
        )
        .join("")}</ul>`
    : "";
  const noteHtml = ctx.note
    ? `<p style="margin:0 0 16px;font-size:14px;color:#374151;background:#F5F4F0;padding:12px 16px;border-left:2px solid #C5CDD9;">${escapeHtml(ctx.note)}</p>`
    : "";

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;color:#0F1115;line-height:1.55;max-width:560px;margin:0 auto;padding:24px;">
      <p style="margin:0 0 16px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#6B7280;">— ${escapeHtml(ctx.tripCode)} · ${escapeHtml(tpl.subjectSuffix)}</p>
      <h1 style="margin:0 0 16px;font-family:'Fraunces',Georgia,serif;font-weight:300;font-size:28px;letter-spacing:-0.01em;line-height:1.2;">
        ${escapeHtml(tpl.headline)}
      </h1>
      <p style="margin:0 0 16px;font-size:15px;">${escapeHtml(tpl.intro)}</p>
      ${itineraryHtml}
      ${noteHtml}
      <hr style="margin:32px 0 16px;border:none;border-top:1px solid #E5E7EB;"/>
      <p style="margin:0;font-size:12px;color:#6B7280;">
        JetNine dispatch<br/>
        <a href="tel:${SITE.dispatchPhoneE164}" style="color:#0F1115;">${SITE.dispatchPhone}</a> · 24/7
      </p>
      <p style="margin:24px 0 0;font-size:10px;color:#9CA3AF;line-height:1.6;">
        JetNine LLC · 14 CFR Part 295 indirect air carrier.
      </p>
    </div>
  `.trim();

  return sendEmail({
    to: ctx.to,
    subject,
    html,
    text,
    replyTo: DISPATCH_NOTIFY,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
