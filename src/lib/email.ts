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
import { findAirport } from "@/lib/airports";
import { minutesWords, passengersWords, replyPromiseWords, tierWords } from "@/lib/desk-status";
import { formatDay } from "@/lib/request-format";

type EmailPayload = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  // For Postmark stream routing; default "outbound".
  stream?: string;
  /**
   * Extra MIME headers. Used for RFC 8058 one-click unsubscribe
   * (List-Unsubscribe + List-Unsubscribe-Post), which Gmail and Yahoo
   * expect on any recurring mail.
   */
  headers?: Record<string, string>;
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
          ...(payload.headers ? { headers: payload.headers } : {}),
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
        ...(payload.headers
          ? { Headers: Object.entries(payload.headers).map(([Name, Value]) => ({ Name, Value })) }
          : {}),
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
//
// Plain words (Phase 6 of the simplification): no "pax", "airframe",
// "FBO", "SLA", enum keys or bare airport codes in anything a person
// reads. Airports read "Los Angeles (VNY)", dates "Fri, Jun 12", labels are
// sentence case (no uppercase, no wide letter-spacing). The bracketed
// reference in a subject (`[JN-2026-0012]`) stays exactly as it was —
// inbound threading matches it.

/**
 * Desk alerts always reach the shared dispatch inbox; per-user notification
 * preferences (Settings › Notifications) add staff on top, never replace it.
 */
function withDispatchInbox(to: string[] | undefined): string | string[] {
  const extra = (to ?? []).map((a) => a.trim().toLowerCase()).filter(Boolean);
  const inbox = DISPATCH_NOTIFY.toLowerCase();
  const list = Array.from(new Set([inbox, ...extra.filter((a) => a !== inbox)]));
  return list.length === 1 ? DISPATCH_NOTIFY : [DISPATCH_NOTIFY, ...list.slice(1)];
}

const DISPATCH_NOTIFY =
  process.env.DISPATCH_NOTIFY_EMAIL ||
  process.env.NEXT_PUBLIC_DISPATCH_EMAIL ||
  "dispatch@jetnine.com";

// ─── Plain-words helpers ──────────────────────────────────────────────

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif";
const WRAP_STYLE = `font-family:${FONT};color:#0F1115;line-height:1.55;max-width:560px;margin:0 auto;padding:24px;`;
const KICKER_STYLE = "margin:0 0 16px;font-size:13px;color:#6B7280;";
const LABEL_CELL_STYLE = "padding:4px 16px 4px 0;color:#6B7280;font-size:13px;vertical-align:top;";
const BUTTON_STYLE =
  "display:inline-block;padding:12px 20px;border-radius:8px;background:#0F1115;color:#FFFFFF;font-weight:600;font-size:14px;text-decoration:none;";
const LEGAL_LINE =
  "JetNine LLC · 14 CFR Part 295 indirect air carrier. All flights operated by an FAA Part 135 direct air carrier.";

function iataOf(code: string): string {
  // The catalog keys one duplicate as "HND_JP"; people read "HND".
  return code.replace(/_.*/, "");
}

/** "Los Angeles (VNY)" from a code (IATA or ICAO) and an optional city. */
function placeWords(code: string | null | undefined, city?: string | null): string {
  const c = code?.trim() || null;
  const a = c ? findAirport(c) : undefined;
  const name = city?.trim() || a?.city || null;
  const shown = a ? iataOf(a.iata) : c;
  if (name && shown) return `${name} (${shown})`;
  return name ?? shown ?? "—";
}

/**
 * Rewrites a pre-built itinerary or route line into plain words:
 * airport codes the catalog knows become "Los Angeles (VNY)", ISO dates
 * become "Fri, Jun 12", "4 pax" becomes "4 passengers". Codes already in
 * parentheses and unknown codes are left alone. Callers outside this file
 * still build lines like "KVNY → KASE · 2026-06-12"; this keeps what the
 * client reads plain without changing those callers.
 */
export function plainTripText(line: string): string {
  return line
    .replace(/\b(\d{4}-\d{2}-\d{2})\b/g, (m) => formatDay(m) ?? m)
    .replace(/\b(\d+)\s*pax\b/gi, (_m, n: string) => passengersWords(Number(n)))
    .replace(/(^|[^(A-Za-z])([A-Z]{3,4}(?:_[A-Z]{2})?)(?![A-Za-z_)])/g, (m, pre: string, code: string) => {
      const a = findAirport(code);
      return a ? `${pre}${a.city} (${iataOf(a.iata)})` : m;
    });
}

/** "Fri, Jun 12" from YYYY-MM-DD; anything else passes through. */
function dayWords(date: string | null | undefined): string | null {
  if (!date) return null;
  return formatDay(date) ?? date;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function button(url: string, label: string): string {
  return `<a href="${escapeHtml(url)}" style="${BUTTON_STYLE}">${escapeHtml(label)}</a>`;
}

type QuoteSubmittedContext = {
  quoteCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  legs: {
    fromIata: string | null;
    toIata: string | null;
    date: string | null;
    /** City words for the route line; looked up from the code when absent. */
    fromCity?: string | null;
    toCity?: string | null;
  }[];
  paxCount: number;
  /** Guest status page (/request/<token>) — included when the quote has one. */
  statusUrl?: string;
  /** Reply-time promise from the desk setting (`getReplyPromiseMinutes`). Default 30. */
  replyMinutes?: number;
};

function legRoute(l: QuoteSubmittedContext["legs"][number]): string {
  return `${placeWords(l.fromIata, l.fromCity)} → ${placeWords(l.toIata, l.toCity)}`;
}

export async function sendQuoteAcknowledgmentEmail(
  ctx: QuoteSubmittedContext,
): Promise<SendResult> {
  const fullName = `${ctx.firstName} ${ctx.lastName}`.trim();
  const route = ctx.legs.map(legRoute).join(", ");
  const when = replyPromiseWords(ctx.replyMinutes);

  // Bracketed so a client's reply threads onto the request (inbound route).
  const subject = `[${ctx.quoteCode}] We've got your trip request`;
  const text = [
    `${fullName},`,
    ``,
    `We've got your trip request. A dispatcher is on it — you'll have options ${when} during operating hours, sooner if it's urgent.`,
    ``,
    `Reference: ${ctx.quoteCode}`,
    `Route: ${route}`,
    `Passengers: ${ctx.paxCount}`,
    ``,
    ...(ctx.statusUrl ? [`Follow your request here: ${ctx.statusUrl}`, ``] : []),
    `Need us sooner? Call dispatch on ${SITE.dispatchPhone}, any time, 24/7.`,
    ``,
    LEGAL_LINE,
  ].join("\n");

  const html = `
    <div style="${WRAP_STYLE}">
      <p style="${KICKER_STYLE}">Reference ${escapeHtml(ctx.quoteCode)}</p>
      <h1 style="margin:0 0 24px;font-family:'Fraunces',Georgia,serif;font-weight:300;font-size:32px;letter-spacing:-0.01em;">
        ${escapeHtml(fullName)}, we&rsquo;ve got it.
      </h1>
      <p style="margin:0 0 16px;font-size:15px;">
        A dispatcher is finding aircraft for you now. You&rsquo;ll have options
        <strong>${escapeHtml(when)}</strong> during operating hours, sooner if it&rsquo;s urgent.
      </p>
      <table style="margin:24px 0;border-collapse:collapse;font-size:14px;">
        <tr><td style="${LABEL_CELL_STYLE}">Route</td><td style="padding:4px 0;">${escapeHtml(route)}</td></tr>
        <tr><td style="${LABEL_CELL_STYLE}">Passengers</td><td style="padding:4px 0;">${ctx.paxCount}</td></tr>
      </table>
      ${
        ctx.statusUrl
          ? `<p style="margin:0 0 8px;">${button(ctx.statusUrl, "Follow your request →")}</p><p style="margin:0 0 24px;color:#6B7280;font-size:13px;">Your options appear on that page as soon as dispatch sends them.</p>`
          : ""
      }
      <p style="margin:24px 0 8px;font-size:13px;color:#6B7280;">Need us sooner?</p>
      <p style="margin:0;font-size:14px;"><a href="tel:${SITE.dispatchPhoneE164}" style="color:#0F1115;">${SITE.dispatchPhone}</a> · 24/7</p>
      <p style="margin:40px 0 0;font-size:11px;color:#9CA3AF;line-height:1.6;">${LEGAL_LINE}</p>
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
  ctx: QuoteSubmittedContext & {
    workbenchUrl: string;
    /** Staff who turned on "A new request comes in"; empty → shared inbox. */
    to?: string[];
  },
): Promise<SendResult> {
  const fullName = `${ctx.firstName} ${ctx.lastName}`.trim();
  const legCount = plural(ctx.legs.length, "leg", "legs");
  const routeLines = ctx.legs.map((l) => `${legRoute(l)}${l.date ? `, ${dayWords(l.date)}` : ""}`);
  const replyIn = minutesWords(ctx.replyMinutes && ctx.replyMinutes > 0 ? ctx.replyMinutes : 30);

  const subject = `[NEW] ${ctx.quoteCode} · New request from ${fullName} · ${legCount}`;
  const lines = [
    `Name: ${fullName}`,
    `Email: ${ctx.email}`,
    `Phone: ${ctx.phone ?? "—"}`,
    `Passengers: ${ctx.paxCount}`,
    ...routeLines.map((r, i) => (ctx.legs.length === 1 ? `Trip: ${r}` : `Leg ${i + 1}: ${r}`)),
    `Reference: ${ctx.quoteCode}`,
  ];
  const text = [
    `New request from ${fullName}.`,
    ``,
    ...lines,
    ``,
    `Open the request: ${ctx.workbenchUrl}`,
    ``,
    `Reply due in ${replyIn} — the reply promise starts now.`,
  ].join("\n");

  const html = `
    <div style="${WRAP_STYLE}">
      <p style="${KICKER_STYLE}">New request · Reference ${escapeHtml(ctx.quoteCode)}</p>
      <h2 style="margin:0 0 16px;font-family:'Fraunces',Georgia,serif;font-weight:300;font-size:24px;letter-spacing:-0.01em;">
        ${escapeHtml(fullName)} · ${escapeHtml(passengersWords(ctx.paxCount))} · ${escapeHtml(legCount)}
      </h2>
      <div style="margin:0 0 16px;padding:12px 16px;background:#F5F4F0;border-left:2px solid #C5CDD9;font-size:14px;">
        ${lines.map((l) => `<p style="margin:0 0 4px;">${escapeHtml(l)}</p>`).join("")}
      </div>
      <p style="margin:0 0 16px;font-size:14px;"><strong>Reply due in ${escapeHtml(replyIn)}</strong> — the reply promise starts now.</p>
      <p style="margin:24px 0 0;">${button(ctx.workbenchUrl, "Open the request →")}</p>
    </div>
  `.trim();

  return sendEmail({
    to: withDispatchInbox(ctx.to),
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
  /** Reply-time promise the form made (`getReplyPromiseMinutes`). Default 30. */
  replyMinutes?: number;
};

const CONTACT_REASON_WORDS: Record<string, string> = {
  quote: "Quote request",
  card: "JetNine Card question",
  trip: "About a trip",
  other: "Something else",
};

function contactReasonWords(reason: string): string {
  return CONTACT_REASON_WORDS[reason] ?? reason.replace(/_/g, " ");
}

/**
 * Desk ping for a public contact-form submission. Single recipient
 * (dispatch), replyTo = the visitor so a dispatcher can answer straight
 * from their mail client without copy-pasting the address.
 */
export async function sendDispatchContactNotification(
  ctx: ContactInquiryContext,
): Promise<SendResult> {
  const fullName = `${ctx.firstName} ${ctx.lastName}`.trim();
  const reason = contactReasonWords(ctx.reason);
  const route =
    ctx.fromText || ctx.toText ? `${ctx.fromText ?? "—"} → ${ctx.toText ?? "—"}` : "—";

  const subject = `[CONTACT] ${fullName} · ${reason}`;
  const lines = [
    `About: ${reason}`,
    `Name: ${fullName}`,
    `Email: ${ctx.email}`,
    `Phone: ${ctx.phone ?? "—"}`,
    `Route: ${route}`,
    `Date: ${ctx.dateText ?? "—"}`,
    `Passengers: ${ctx.paxText ?? "—"}`,
  ];
  const text = [
    `New message from the contact form.`,
    ``,
    ...lines,
    ctx.notes ? `\nTheir note:\n${ctx.notes}` : ``,
    ``,
    `Open messages: ${ctx.inquiriesUrl}`,
    ``,
    `The form told them they'd hear back ${replyPromiseWords(ctx.replyMinutes)} during operating hours.`,
  ].join("\n");

  const notesHtml = ctx.notes
    ? `<p style="margin:12px 0 4px;color:#6B7280;font-size:13px;">Their note</p><p style="margin:0;white-space:pre-wrap;">${escapeHtml(ctx.notes)}</p>`
    : "";

  const html = `
    <div style="${WRAP_STYLE}">
      <p style="${KICKER_STYLE}">Contact form · ${escapeHtml(reason)}</p>
      <h2 style="margin:0 0 16px;font-family:'Fraunces',Georgia,serif;font-weight:300;font-size:24px;letter-spacing:-0.01em;">
        ${escapeHtml(fullName)}
      </h2>
      <div style="margin:0 0 16px;padding:12px 16px;background:#F5F4F0;border-left:2px solid #C5CDD9;font-size:14px;">
        ${lines.map((l) => `<p style="margin:0 0 4px;">${escapeHtml(l)}</p>`).join("")}
        ${notesHtml}
      </div>
      <p style="margin:0 0 16px;font-size:14px;color:#374151;">The form told them they&rsquo;d hear back ${escapeHtml(replyPromiseWords(ctx.replyMinutes))} during operating hours.</p>
      <p style="margin:24px 0 0;">${button(ctx.inquiriesUrl, "Open messages →")}</p>
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
    : `[${ctx.subjectCode}] A note from JetNine dispatch`;

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
    <div style="${WRAP_STYLE}">
      <p style="${KICKER_STYLE}">Reference ${escapeHtml(ctx.subjectCode)}</p>
      <div style="font-size:15px;">${bodyHtml}</div>
      <hr style="margin:32px 0 16px;border:none;border-top:1px solid #E5E7EB;"/>
      <p style="margin:0;font-size:13px;color:#6B7280;">
        ${escapeHtml(signature)}<br/>
        <a href="tel:${SITE.dispatchPhoneE164}" style="color:#0F1115;">${SITE.dispatchPhone}</a> · 24/7
      </p>
      <p style="margin:24px 0 0;font-size:11px;color:#9CA3AF;line-height:1.6;">
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
// in a row — they see "Confirmed", "Boarding now", "Cancelled — weather",
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
  // Itinerary summary lines, e.g. ["KLAX → KSFO · 2026-06-12", "4 pax"].
  // Rendered through plainTripText, so the client reads
  // "Los Angeles (LAX) → San Francisco (SFO) · Fri, Jun 12".
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
    headline: "Your trip is confirmed.",
    intro:
      "Everything is booked. We'll send another note when the aircraft is ready to board — usually about 30 minutes before departure.",
  },
  boarding: {
    subjectSuffix: "Boarding now",
    headline: "The aircraft is ready when you are.",
    intro:
      "The crew is on board. Head to the private terminal whenever you're ready; if you're already there, we'll walk you out to the aircraft.",
  },
  completed: {
    subjectSuffix: "Trip complete",
    headline: "You've landed. We hope it was a good flight.",
    intro:
      "That's this trip done. Your receipt and a short trip summary will follow by email. If anything was off — or especially good — we'd like to hear about it.",
  },
  cancelled_wx: {
    subjectSuffix: "Cancelled — weather",
    headline: "Weather got in the way.",
    intro:
      "We've cancelled this flight because the weather isn't safe to fly through. A dispatcher will follow up with options to rebook; if you'd like to talk it through now, call the number below.",
  },
  cancelled_other: {
    subjectSuffix: "Cancelled",
    headline: "This trip has been cancelled.",
    intro:
      "A dispatcher will be in touch about rebooking. The number below is the fastest way to talk now.",
  },
  diverted: {
    subjectSuffix: "Diverted",
    headline: "We're landing at a different airport.",
    intro:
      "Conditions ahead ruled out the original destination, so the aircraft is landing somewhere else. A dispatcher is arranging a car from the new airport — expect a call within minutes.",
  },
  irregular_ops: {
    subjectSuffix: "A change to your trip",
    headline: "Something has changed — and we're on it.",
    intro:
      "Something has changed on this trip. Please don't change your own plans yet; a dispatcher is calling you now with the details.",
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
  const itinerary = (ctx.itineraryLines ?? []).map(plainTripText);

  const itineraryText = itinerary.length ? `\n\nYour trip:\n  ${itinerary.join("\n  ")}\n` : "";
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

  const itineraryHtml = itinerary.length
    ? `<ul style="margin:16px 0;padding:0;list-style:none;">${itinerary
        .map((l) => `<li style="margin:0 0 6px;font-size:14px;color:#0F1115;">${escapeHtml(l)}</li>`)
        .join("")}</ul>`
    : "";
  const noteHtml = ctx.note
    ? `<p style="margin:0 0 16px;font-size:14px;color:#374151;background:#F5F4F0;padding:12px 16px;border-left:2px solid #C5CDD9;">${escapeHtml(ctx.note)}</p>`
    : "";

  const html = `
    <div style="${WRAP_STYLE}">
      <p style="${KICKER_STYLE}">${escapeHtml(tpl.subjectSuffix)} · Reference ${escapeHtml(ctx.tripCode)}</p>
      <h1 style="margin:0 0 16px;font-family:'Fraunces',Georgia,serif;font-weight:300;font-size:28px;letter-spacing:-0.01em;line-height:1.2;">
        ${escapeHtml(tpl.headline)}
      </h1>
      <p style="margin:0 0 16px;font-size:15px;">${escapeHtml(tpl.intro)}</p>
      ${itineraryHtml}
      ${noteHtml}
      <hr style="margin:32px 0 16px;border:none;border-top:1px solid #E5E7EB;"/>
      <p style="margin:0;font-size:13px;color:#6B7280;">
        JetNine dispatch<br/>
        <a href="tel:${SITE.dispatchPhoneE164}" style="color:#0F1115;">${SITE.dispatchPhone}</a> · 24/7
      </p>
      <p style="margin:24px 0 0;font-size:11px;color:#9CA3AF;line-height:1.6;">
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

// ─── Quote options → client ────────────────────────────────────────────
// The email that delivers on the core promise: 3–5 vetted aircraft with
// all-in pricing. Deliberately omits tail numbers and operator names —
// standard broker practice pre-booking (and the operator cost never leaves
// the building). Vetting credentials are shown without naming the operator.
// The bracketed quote code in the subject is what threads any reply back
// into the workbench via the inbound-email router.

export type QuoteOptionEmailItem = {
  optionNumber: number;
  aircraftType: string | null;
  yearOfMake: number | null;
  paxCapacity: number | null;
  categoryLabel: string | null;
  vetting: string | null; // e.g. "ARG/US Platinum · Wyvern Wingman"
  clientPriceUsd: number;
};

export type QuoteOptionsEmailContext = {
  quoteCode: string;
  firstName: string;
  to: string;
  route: string;
  paxCount: number;
  options: QuoteOptionEmailItem[];
  /** Guest status page where the client can pick an option. */
  statusUrl?: string;
};

const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const ALL_IN_WORDS =
  "fuel, taxes (including federal excise tax), repositioning flights and crew";

export async function sendQuoteOptionsEmail(
  ctx: QuoteOptionsEmailContext,
): Promise<SendResult> {
  const n = ctx.options.length;
  const route = plainTripText(ctx.route);
  const pax = passengersWords(ctx.paxCount);
  const subject = `[${ctx.quoteCode}] Your aircraft options — ${n} vetted aircraft`;

  const specsOf = (o: QuoteOptionEmailItem) =>
    [
      o.yearOfMake ? `Built ${o.yearOfMake}` : null,
      o.categoryLabel,
      o.paxCapacity ? `${o.paxCapacity} seats` : null,
    ]
      .filter(Boolean)
      .join(" · ");

  const optText = ctx.options
    .map((o) => {
      const specs = specsOf(o);
      return [
        `Option ${o.optionNumber} — ${o.aircraftType ?? "Aircraft"}`,
        specs ? `  ${specs}` : null,
        o.vetting ? `  Operator safety audits: ${o.vetting}` : null,
        `  All-in price: ${usdFmt.format(o.clientPriceUsd)}`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  const text = [
    `${ctx.firstName},`,
    ``,
    `Here are your options for ${route} (${pax}). Every aircraft below flies with an independently vetted FAA Part 135 operator, and every price is all-in — ${ALL_IN_WORDS}.`,
    ``,
    optText,
    ``,
    ...(ctx.statusUrl ? [`Choose an option here: ${ctx.statusUrl}`, ``] : []),
    `To hold an aircraft, reply to this email or call dispatch on ${SITE.dispatchPhone} — we answer 24/7. Availability moves fast, and a hold costs nothing.`,
    ``,
    `Reference: ${ctx.quoteCode}`,
    ``,
    LEGAL_LINE,
  ].join("\n");

  const optionsHtml = ctx.options
    .map((o) => {
      const specs = specsOf(o);
      return `
        <div style="border:1px solid #E5E7EB;border-radius:8px;padding:16px 20px;margin:0 0 12px;">
          <p style="margin:0 0 2px;font-size:13px;color:#6B7280;">Option ${o.optionNumber}</p>
          <p style="margin:0 0 4px;font-family:'Fraunces',Georgia,serif;font-size:20px;font-weight:400;">${escapeHtml(o.aircraftType ?? "Aircraft")}</p>
          ${specs ? `<p style="margin:0 0 4px;font-size:13px;color:#374151;">${escapeHtml(specs)}</p>` : ""}
          ${o.vetting ? `<p style="margin:0 0 8px;font-size:13px;color:#6B7280;">Operator safety audits: ${escapeHtml(o.vetting)}</p>` : ""}
          <p style="margin:8px 0 0;font-size:22px;font-family:'Fraunces',Georgia,serif;font-weight:300;">${usdFmt.format(o.clientPriceUsd)} <span style="font-size:13px;color:#6B7280;font-family:${FONT};">all-in</span></p>
        </div>`;
    })
    .join("");

  const html = `
    <div style="${WRAP_STYLE}">
      <p style="${KICKER_STYLE}">Your options · Reference ${escapeHtml(ctx.quoteCode)}</p>
      <h1 style="margin:0 0 16px;font-family:'Fraunces',Georgia,serif;font-weight:300;font-size:28px;letter-spacing:-0.01em;line-height:1.2;">
        ${escapeHtml(ctx.firstName)}, your aircraft options are in.
      </h1>
      <p style="margin:0 0 20px;font-size:15px;">
        ${escapeHtml(route)} · ${escapeHtml(pax)}. Every aircraft below flies with an
        independently vetted FAA Part 135 operator, and every price is
        <strong>all-in</strong> — ${ALL_IN_WORDS}.
      </p>
      ${optionsHtml}
      ${ctx.statusUrl ? `<p style="margin:20px 0 0;">${button(ctx.statusUrl, "Choose an option →")}</p>` : ""}
      <p style="margin:20px 0 0;font-size:14px;">
        To hold an aircraft, ${ctx.statusUrl ? "pick one on the page above, " : ""}<strong>reply to this email</strong> or call
        <a href="tel:${SITE.dispatchPhoneE164}" style="color:#0F1115;">${SITE.dispatchPhone}</a> — 24/7.
        Availability moves fast, and a hold costs nothing.
      </p>
      <hr style="margin:32px 0 16px;border:none;border-top:1px solid #E5E7EB;"/>
      <p style="margin:24px 0 0;font-size:11px;color:#9CA3AF;line-height:1.6;">${LEGAL_LINE}</p>
    </div>
  `.trim();

  return sendEmail({ to: ctx.to, subject, html, text, replyTo: DISPATCH_NOTIFY });
}


// ─── Booking / money-path senders ─────────────────────────────────────────
// Added in the notifications round: until these existed, a customer could
// book a trip, receive an invoice, and pay it without a single email from
// JetNine (Stripe's own receipt aside). Same inline-HTML convention as the
// senders above.

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");

function moneyRow(label: string, value: string): string {
  return `<tr><td style="${LABEL_CELL_STYLE}">${escapeHtml(label)}</td><td style="padding:4px 0;">${escapeHtml(value)}</td></tr>`;
}

function brandedShell(kicker: string, headline: string, inner: string): string {
  return `
    <div style="${WRAP_STYLE}">
      <p style="${KICKER_STYLE}">${escapeHtml(kicker)}</p>
      <h1 style="margin:0 0 16px;font-family:'Fraunces',Georgia,serif;font-weight:300;font-size:28px;letter-spacing:-0.01em;line-height:1.2;">${escapeHtml(headline)}</h1>
      ${inner}
      <hr style="margin:32px 0 16px;border:none;border-top:1px solid #E5E7EB;"/>
      <p style="margin:0;font-size:13px;color:#6B7280;">JetNine dispatch<br/><a href="tel:${SITE.dispatchPhoneE164}" style="color:#0F1115;">${SITE.dispatchPhone}</a> · 24/7</p>
      <p style="margin:24px 0 0;font-size:11px;color:#9CA3AF;line-height:1.6;">${LEGAL_LINE}</p>
    </div>`.trim();
}

export async function sendBookingConfirmationEmail(ctx: {
  to: string;
  firstName: string;
  tripCode: string;
  quoteCode: string;
  itineraryLines: string[];
  paxCount: number;
  totalUsd: number | null;
  invoiceIsDue: boolean;
  drawdown: { amountUsd: number; remainingBalanceUsd: number } | null;
}): Promise<SendResult> {
  const subject = `[${ctx.tripCode}] Booked — your trip is confirmed`;
  const itineraryLines = ctx.itineraryLines.map(plainTripText);
  const pax = passengersWords(ctx.paxCount);
  const moneyLines: string[] = [];
  if (ctx.totalUsd != null) moneyLines.push(`All-in total: ${usdFmt.format(ctx.totalUsd)}`);
  if (ctx.drawdown) {
    moneyLines.push(
      `Charged to your reserve: ${usdFmt.format(ctx.drawdown.amountUsd)} (remaining balance ${usdFmt.format(ctx.drawdown.remainingBalanceUsd)}) — nothing more to pay.`,
    );
  } else if (ctx.invoiceIsDue) {
    moneyLines.push(`Your invoice is ready in your account: ${SITE_URL}/account/invoices`);
  } else {
    moneyLines.push("Your invoice follows shortly by email.");
  }

  const text = [
    `${ctx.firstName},`,
    ``,
    `Your trip is confirmed. Reference ${ctx.tripCode} (your request was ${ctx.quoteCode}).`,
    ``,
    ...itineraryLines,
    ctx.paxCount ? pax : null,
    ``,
    ...moneyLines,
    ``,
    `The crew, where to go (the private terminal) and the timing follow from dispatch as the trip firms up. Reply to this email or call ${SITE.dispatchPhone} any time.`,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  const html = brandedShell(
    `Confirmed · Reference ${ctx.tripCode}`,
    `${ctx.firstName}, you're booked.`,
    `
      <p style="margin:0 0 16px;font-size:15px;">Your trip is confirmed${ctx.paxCount ? ` for ${escapeHtml(pax)}` : ""}.</p>
      <table style="margin:16px 0;border-collapse:collapse;font-size:14px;">
        ${itineraryLines.map((l) => moneyRow("Flight", l)).join("")}
        ${ctx.totalUsd != null ? moneyRow("All-in total", usdFmt.format(ctx.totalUsd)) : ""}
      </table>
      ${
        ctx.drawdown
          ? `<p style="margin:0 0 16px;font-size:14px;">${usdFmt.format(ctx.drawdown.amountUsd)} was charged to your reserve (remaining balance <strong>${usdFmt.format(ctx.drawdown.remainingBalanceUsd)}</strong>) — nothing more to pay.</p>`
          : ctx.invoiceIsDue
            ? `<p style="margin:0 0 16px;font-size:14px;">Your invoice is ready — <a href="${SITE_URL}/account/invoices" style="color:#0F1115;">view and pay it in your account</a>.</p>`
            : `<p style="margin:0 0 16px;font-size:14px;">Your invoice follows shortly by email.</p>`
      }
      <p style="margin:0;font-size:14px;">The crew, where to go (the private terminal) and the timing follow from dispatch as the trip firms up. Reply to this email or call any time.</p>
    `,
  );

  return sendEmail({ to: ctx.to, subject, html, text, replyTo: DISPATCH_NOTIFY });
}

export async function sendInvoiceIssuedEmail(ctx: {
  to: string;
  firstName: string;
  invoiceCode: string;
  tripCode: string | null;
  totalUsd: number;
  dueOn: string | null;
}): Promise<SendResult> {
  const due = dayWords(ctx.dueOn);
  const subject = `[${ctx.invoiceCode}] Your JetNine invoice — ${usdFmt.format(ctx.totalUsd)}${due ? ` due ${due}` : ""}`;
  const text = [
    `${ctx.firstName},`,
    ``,
    `Your invoice is ready (reference ${ctx.invoiceCode}${ctx.tripCode ? `, for trip ${ctx.tripCode}` : ""}).`,
    ``,
    `Total, all-in: ${usdFmt.format(ctx.totalUsd)}`,
    due ? `Due: ${due}` : null,
    ``,
    `View and pay by card: ${SITE_URL}/account/invoices`,
    `Prefer a bank wire, or have a question? Reply here or call ${SITE.dispatchPhone}.`,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  const html = brandedShell(
    `Invoice · Reference ${ctx.invoiceCode}`,
    `${ctx.firstName}, your invoice is ready.`,
    `
      <table style="margin:16px 0;border-collapse:collapse;font-size:14px;">
        ${ctx.tripCode ? moneyRow("Trip", ctx.tripCode) : ""}
        ${moneyRow("Total, all-in", usdFmt.format(ctx.totalUsd))}
        ${due ? moneyRow("Due", due) : ""}
      </table>
      <p style="margin:0 0 12px;">${button(`${SITE_URL}/account/invoices`, "View and pay in your account →")}</p>
      <p style="margin:0;font-size:13px;color:#374151;">Prefer a bank wire, or have a question? Reply here or call dispatch.</p>
    `,
  );

  return sendEmail({ to: ctx.to, subject, html, text, replyTo: DISPATCH_NOTIFY });
}

export async function sendPaymentReceiptEmail(ctx: {
  to: string;
  firstName: string;
  invoiceCode: string;
  tripCode: string | null;
  amountUsd: number | null;
}): Promise<SendResult> {
  const amount = ctx.amountUsd != null ? usdFmt.format(ctx.amountUsd) : "your payment";
  const subject = `[${ctx.invoiceCode}] Payment received — thank you`;
  const text = [
    `${ctx.firstName},`,
    ``,
    `We've received ${amount} for invoice ${ctx.invoiceCode}${ctx.tripCode ? ` (trip ${ctx.tripCode})` : ""}. You're all set.`,
    ``,
    `Your invoices: ${SITE_URL}/account/invoices`,
  ].join("\n");
  const html = brandedShell(
    `Paid · Reference ${ctx.invoiceCode}`,
    `${ctx.firstName}, payment received.`,
    `
      <p style="margin:0 0 16px;font-size:15px;">We&rsquo;ve received <strong>${escapeHtml(amount)}</strong> for invoice ${escapeHtml(ctx.invoiceCode)}${ctx.tripCode ? ` (trip ${escapeHtml(ctx.tripCode)})` : ""}. You&rsquo;re all set.</p>
      <p style="margin:0;font-size:14px;color:#374151;"><a href="${SITE_URL}/account/invoices" style="color:#0F1115;">See your invoices →</a></p>
    `,
  );
  return sendEmail({ to: ctx.to, subject, html, text, replyTo: DISPATCH_NOTIFY });
}

export async function sendPaymentFailedEmail(ctx: {
  to: string;
  firstName: string;
  invoiceCode: string;
  reason: string | null;
}): Promise<SendResult> {
  const subject = `[${ctx.invoiceCode}] Payment didn't go through`;
  const text = [
    `${ctx.firstName},`,
    ``,
    `The card payment for invoice ${ctx.invoiceCode} didn't go through${ctx.reason ? ` (${ctx.reason})` : ""}. Nothing was charged.`,
    ``,
    `Try again: ${SITE_URL}/account/invoices`,
    `Or reply to this email or call ${SITE.dispatchPhone} and we'll sort it out — a bank wire works too.`,
  ].join("\n");
  const html = brandedShell(
    `Payment needs another try · Reference ${ctx.invoiceCode}`,
    `${ctx.firstName}, that payment didn't go through.`,
    `
      <p style="margin:0 0 16px;font-size:15px;">The card payment for invoice ${escapeHtml(ctx.invoiceCode)} didn&rsquo;t go through${ctx.reason ? ` (<em>${escapeHtml(ctx.reason)}</em>)` : ""}. Nothing was charged.</p>
      <p style="margin:0 0 12px;">${button(`${SITE_URL}/account/invoices`, "Try again →")}</p>
      <p style="margin:0;font-size:13px;color:#374151;">Or reply to this email or call dispatch — a bank wire works too.</p>
    `,
  );
  return sendEmail({ to: ctx.to, subject, html, text, replyTo: DISPATCH_NOTIFY });
}

export async function sendContactAckEmail(ctx: {
  to: string;
  firstName: string;
  /** Reply-time promise from the desk setting (`getReplyPromiseMinutes`). Default 30. */
  replyMinutes?: number;
}): Promise<SendResult> {
  const when = replyPromiseWords(ctx.replyMinutes);
  const subject = "We've got your message — JetNine dispatch";
  const text = [
    `${ctx.firstName},`,
    ``,
    `Your message reached the dispatch desk. A person replies ${when} during operating hours — usually much sooner.`,
    ``,
    `Need us right now? ${SITE.dispatchPhone}, 24/7.`,
  ].join("\n");
  const html = brandedShell(
    "Message received",
    `${ctx.firstName}, we've got it.`,
    `
      <p style="margin:0 0 16px;font-size:15px;">Your message reached the dispatch desk. A person replies <strong>${escapeHtml(when)}</strong> during operating hours — usually much sooner.</p>
      <p style="margin:0;font-size:14px;">Need us right now? <a href="tel:${SITE.dispatchPhoneE164}" style="color:#0F1115;">${SITE.dispatchPhone}</a>, 24/7.</p>
    `,
  );
  return sendEmail({ to: ctx.to, subject, html, text, replyTo: DISPATCH_NOTIFY });
}

/**
 * Generic operational alert to the dispatch mailbox. One sender for the
 * whole family of desk pings (payment events, inbound replies, unrouted
 * inbound, overdue replies, new leads) so each callsite stays one line.
 * `lines` render as plain paragraphs; `link` becomes the button.
 */
export async function sendDispatchAlert(ctx: {
  subject: string;
  headline: string;
  lines: string[];
  link?: { label: string; url: string };
  /**
   * Staff addresses from Settings › Notifications (`recipientsFor`). When
   * empty or omitted the alert goes to the shared dispatch inbox, so a
   * misread preference never silences a page.
   */
  to?: string[];
}): Promise<SendResult> {
  const text = [ctx.headline, "", ...ctx.lines, "", ctx.link ? `${ctx.link.label}: ${ctx.link.url}` : null]
    .filter((l): l is string => l !== null)
    .join("\n");
  const html = brandedShell(
    "For the desk",
    ctx.headline,
    `
      ${ctx.lines.map((l) => (l ? `<p style="margin:0 0 10px;font-size:14px;">${escapeHtml(l)}</p>` : `<p style="margin:0 0 10px;height:4px;"></p>`)).join("")}
      ${ctx.link ? `<p style="margin:16px 0 0;">${button(ctx.link.url, `${ctx.link.label} →`)}</p>` : ""}
    `,
  );
  return sendEmail({ to: withDispatchInbox(ctx.to), subject: ctx.subject, html, text });
}


// ─── Round-2 senders: dunning, membership, quote lifecycle ────────────────

export async function sendInvoiceReminderEmail(ctx: {
  to: string;
  firstName: string;
  invoiceCode: string;
  totalUsd: number | null;
  dueOn: string | null;
  kind: "due_soon" | "overdue";
}): Promise<SendResult> {
  const amount = ctx.totalUsd != null ? usdFmt.format(ctx.totalUsd) : "your invoice";
  const overdue = ctx.kind === "overdue";
  const due = dayWords(ctx.dueOn);
  const subject = overdue
    ? `[${ctx.invoiceCode}] Invoice overdue — ${amount}`
    : `[${ctx.invoiceCode}] Reminder — ${amount} due ${due ?? "soon"}`;
  const text = [
    `${ctx.firstName},`,
    ``,
    overdue
      ? `Invoice ${ctx.invoiceCode} (${amount}) is past its due date${due ? ` of ${due}` : ""}.`
      : `A reminder that invoice ${ctx.invoiceCode} (${amount}) is due ${due ?? "soon"}.`,
    ``,
    `Pay by card: ${SITE_URL}/account/invoices`,
    `Prefer a bank wire, or does something look off? Reply here or call ${SITE.dispatchPhone} — 24/7.`,
  ].join("\n");
  const html = brandedShell(
    `${overdue ? "Overdue" : "Due soon"} · Reference ${ctx.invoiceCode}`,
    overdue ? `${ctx.firstName}, this invoice is past due.` : `${ctx.firstName}, a quick reminder.`,
    `
      <p style="margin:0 0 16px;font-size:15px;">Invoice <strong>${escapeHtml(ctx.invoiceCode)}</strong> (${escapeHtml(amount)}) ${overdue ? `is past its due date${due ? ` of ${escapeHtml(due)}` : ""}` : `is due ${escapeHtml(due ?? "soon")}`}.</p>
      <p style="margin:0 0 12px;">${button(`${SITE_URL}/account/invoices`, "Pay in your account →")}</p>
      <p style="margin:0;font-size:13px;color:#374151;">Prefer a bank wire, or does something look off? Reply here or call dispatch — 24/7.</p>
    `,
  );
  return sendEmail({ to: ctx.to, subject, html, text, replyTo: DISPATCH_NOTIFY });
}

export async function sendMembershipActivatedEmail(ctx: {
  to: string;
  firstName: string;
  program: string;
  depositUsd: number;
}): Promise<SendResult> {
  // `program` is the membership enum key (card_100, reserve_250, …);
  // people read "JetNine Card · 100 hours".
  const program = tierWords(ctx.program);
  const subject = `Your JetNine membership is active — ${program}`;
  const text = [
    `${ctx.firstName},`,
    ``,
    `Your membership (${program}) is active, and your ${usdFmt.format(ctx.depositUsd)} deposit is credited to your reserve.`,
    ``,
    `Balance and activity: ${SITE_URL}/account/members`,
    `Book any time: ${SITE_URL}/quote/mission — or just call ${SITE.dispatchPhone}.`,
  ].join("\n");
  const html = brandedShell(
    "Membership active",
    `${ctx.firstName}, welcome aboard.`,
    `
      <p style="margin:0 0 16px;font-size:15px;">Your membership (<strong>${escapeHtml(program)}</strong>) is active, and your <strong>${usdFmt.format(ctx.depositUsd)}</strong> deposit is credited to your reserve.</p>
      <p style="margin:0 0 12px;">${button(`${SITE_URL}/account/members`, "See your balance →")}</p>
      <p style="margin:0;font-size:13px;color:#374151;">Book any time from your account or with one phone call — the desk answers 24/7.</p>
    `,
  );
  return sendEmail({ to: ctx.to, subject, html, text, replyTo: DISPATCH_NOTIFY });
}

export async function sendTopUpReceiptEmail(ctx: {
  to: string;
  firstName: string;
  amountUsd: number;
}): Promise<SendResult> {
  const subject = `Reserve top-up received — ${usdFmt.format(ctx.amountUsd)}`;
  const text = [
    `${ctx.firstName},`,
    ``,
    `We've added ${usdFmt.format(ctx.amountUsd)} to your reserve.`,
    ``,
    `Balance and history: ${SITE_URL}/account/members`,
  ].join("\n");
  const html = brandedShell(
    "Reserve top-up",
    `${ctx.firstName}, it's in your reserve.`,
    `
      <p style="margin:0 0 16px;font-size:15px;">We&rsquo;ve added <strong>${usdFmt.format(ctx.amountUsd)}</strong> to your reserve.</p>
      <p style="margin:0;font-size:14px;"><a href="${SITE_URL}/account/members" style="color:#0F1115;font-weight:600;">Balance and history →</a></p>
    `,
  );
  return sendEmail({ to: ctx.to, subject, html, text, replyTo: DISPATCH_NOTIFY });
}

export async function sendQuoteLifecycleEmail(ctx: {
  to: string;
  firstName: string;
  quoteCode: string;
  kind: "held" | "expired";
}): Promise<SendResult> {
  const held = ctx.kind === "held";
  const subject = held
    ? `[${ctx.quoteCode}] We're holding an aircraft for you`
    : `[${ctx.quoteCode}] Your quote has expired — want fresh prices?`;
  const text = [
    `${ctx.firstName},`,
    ``,
    held
      ? `Dispatch is holding an aircraft for your request. Holds don't last long — reply to this email or call ${SITE.dispatchPhone} to confirm, and we'll send the contract.`
      : `Your quote ${ctx.quoteCode} has expired — charter availability and prices change daily. Reply to this email or call ${SITE.dispatchPhone} and we'll send fresh prices in minutes.`,
  ].join("\n");
  const html = brandedShell(
    `${held ? "On hold" : "Expired"} · Reference ${ctx.quoteCode}`,
    held ? `${ctx.firstName}, we're holding an aircraft.` : `${ctx.firstName}, those prices have expired.`,
    `
      <p style="margin:0 0 16px;font-size:15px;">${
        held
          ? "Dispatch is holding an aircraft for your request. Holds don&rsquo;t last long — <strong>reply to this email</strong> or call to confirm, and we&rsquo;ll send the contract."
          : `Quote ${escapeHtml(ctx.quoteCode)} has expired — availability and prices change daily. <strong>Reply to this email</strong> or call, and we&rsquo;ll send fresh prices in minutes.`
      }</p>
    `,
  );
  return sendEmail({ to: ctx.to, subject, html, text, replyTo: DISPATCH_NOTIFY });
}


export async function sendRefundIssuedEmail(ctx: {
  to: string;
  firstName: string;
  invoiceCode: string;
  tripCode: string | null;
  amountUsd: number | null;
}): Promise<SendResult> {
  const amount = ctx.amountUsd != null ? usdFmt.format(ctx.amountUsd) : "your payment";
  const subject = `[${ctx.invoiceCode}] Refund issued — ${amount}`;
  const text = [
    `${ctx.firstName},`,
    ``,
    `With your trip${ctx.tripCode ? ` ${ctx.tripCode}` : ""} cancelled, we've refunded ${amount} to your card (invoice ${ctx.invoiceCode}).`,
    `Refunds usually reach your account in 5–10 business days, depending on your bank.`,
    ``,
    `Questions? Reply here or call ${SITE.dispatchPhone} — 24/7.`,
  ].join("\n");
  const html = brandedShell(
    `Refunded · Reference ${ctx.invoiceCode}`,
    `${ctx.firstName}, your refund is on its way.`,
    `
      <p style="margin:0 0 16px;font-size:15px;">With your trip${ctx.tripCode ? ` <strong>${escapeHtml(ctx.tripCode)}</strong>` : ""} cancelled, we&rsquo;ve refunded <strong>${escapeHtml(amount)}</strong> to your card (invoice ${escapeHtml(ctx.invoiceCode)}).</p>
      <p style="margin:0;font-size:13px;color:#374151;">Refunds usually reach your account in 5–10 business days, depending on your bank. Questions? Reply here or call dispatch — 24/7.</p>
    `,
  );
  return sendEmail({ to: ctx.to, subject, html, text, replyTo: DISPATCH_NOTIFY });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
