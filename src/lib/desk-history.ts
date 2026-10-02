import { requestStage, tripState, DESK_ROLE_WORDS, type DeskRole } from "@/lib/desk-status";

/**
 * Settings › History: turns an audit_log row into one plain sentence.
 *
 *   "Alex sent 3 options to Tom Okafor"
 *   "Jordan marked Marcus Lee's trip as Confirmed"
 *   "System warned the desk that Dana Whitfield's request needs a reply soon"
 *
 * The subject words carry a link to the new desk URL when the subject type
 * has a page. Unknown actions fall back to
 * "<Actor> did <action words> on <subject type words> <code>".
 */

export type AuditSentenceRow = {
  action: string;
  subjectType: string;
  subjectId: string | null;
  subjectCode: string | null;
  diff: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  actorFirstName: string | null;
  actorLastName: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  /** Client / member name resolved from the subject, when the page joined it. */
  subjectName: string | null;
};

export type AuditSentence = {
  /** Words before the link (includes the actor). */
  pre: string;
  /** Linked subject words, when the subject has a desk page. */
  link: { label: string; href: string } | null;
  /** Words after the link. */
  post: string;
  /** Muted reference for dispatch (code), when one exists. */
  ref: string | null;
};

// ─── Where a subject lives on the desk ──────────────────────────────────

const SUBJECT_HREF: Partial<Record<string, (id: string | null) => string | null>> = {
  quote: (id) => (id ? `/admin/requests/${id}` : "/admin/requests"),
  trip: (id) => (id ? `/admin/trips/${id}` : "/admin/trips"),
  member: (id) => (id ? `/admin/clients/${id}` : "/admin/clients"),
  membership: () => "/admin/clients",
  reserve_transaction: () => "/admin/clients",
  operator: (id) => (id ? `/admin/operators/${id}` : "/admin/operators"),
  aircraft: (id) => (id ? `/admin/aircraft/${id}` : "/admin/aircraft"),
  empty_leg: () => "/admin/empty-leg",
  ai_provider: () => "/admin/settings/ai",
  user_role: () => "/admin/settings/team",
  contact_inquiry: () => "/admin/messages",
  system: () => "/admin/settings/notifications",
};

const SUBJECT_WORDS: Record<string, string> = {
  quote: "a request",
  trip: "a trip",
  invoice: "an invoice",
  member: "a client",
  membership: "a membership",
  reserve_transaction: "a reserve transaction",
  operator: "an operator",
  aircraft: "an aircraft",
  empty_leg: "an empty leg",
  empty_leg_watchlist: "an empty-leg watchlist",
  blog_subscriber: "a blog subscriber",
  ai_provider: "an AI provider",
  contact_inquiry: "a contact message",
  preferences: "client preferences",
  user_role: "a team member",
  system: "the desk settings",
};

export function subjectHref(subjectType: string, subjectId: string | null): string | null {
  const build = SUBJECT_HREF[subjectType];
  return build ? build(subjectId) : null;
}

// ─── Helpers ────────────────────────────────────────────────────────────

export function actorName(row: Pick<AuditSentenceRow, "actorFirstName" | "actorLastName" | "actorEmail">): string {
  const first = row.actorFirstName?.trim();
  if (first) return first;
  const last = row.actorLastName?.trim();
  if (last) return last;
  if (row.actorEmail) return row.actorEmail.split("@")[0];
  return "System";
}

function possessive(name: string): string {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function after(diff: Record<string, unknown> | null, key: string): string | null {
  const d = diff?.[key];
  if (d && typeof d === "object" && "after" in (d as Record<string, unknown>)) {
    return str((d as Record<string, unknown>).after);
  }
  return str(d);
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function roleWords(v: string | null): string {
  if (v === "owner" || v === "team") return DESK_ROLE_WORDS[v as DeskRole].label;
  if (v === "admin" || v === "superadmin") return DESK_ROLE_WORDS.owner.label;
  if (v === "dispatcher") return DESK_ROLE_WORDS.team.label;
  return v ?? "a new role";
}

type Ctx = {
  actor: string;
  /** Client name from the subject, or a generic noun. */
  name: string;
  /** True when a real client name was resolved. */
  named: boolean;
  code: string | null;
  diff: Record<string, unknown> | null;
  meta: Record<string, unknown> | null;
  href: string | null;
};

/** Sentence pieces: `[pre, linkLabel, post]`, or a plain string for no link. */
type Built = string | [pre: string, label: string, post?: string];

type Entry = (c: Ctx) => Built;

// ─── The dictionary ─────────────────────────────────────────────────────
// One entry per action string used in the codebase (grep "action: \"…\"").

const VERBS: Record<string, Entry> = {
  // Requests
  "quote.submit": (c) => (c.named ? [`${c.name} sent `, "a new request"] : [`${c.actor} sent `, "a new request"]),
  "quote.status.update": (c) => {
    const to = after(c.diff, "status");
    return [`${c.actor} marked `, `${possessive(c.name)} request`, ` as ${to ? requestStage(to).label : "updated"}`];
  },
  "quote.dispatcher.assign": (c) => [`${c.actor} took `, `${possessive(c.name)} request`],
  "quote.message.post": (c) => [`${c.actor} messaged ${c.name} about `, "the request"],
  "quote.notify.email": (c) => [`System sent the confirmation emails for `, `${possessive(c.name)} request`],
  "quote.option.add": (c) => [`${c.actor} added an option to `, `${possessive(c.name)} request`],
  "quote.option.update": (c) => [`${c.actor} changed an option on `, `${possessive(c.name)} request`],
  "quote.option.remove": (c) => [`${c.actor} removed an option from `, `${possessive(c.name)} request`],
  "quote.options.send": (c) => {
    const n = num(c.meta?.count);
    return [`${c.actor} sent ${n != null ? plural(n, "option") : "options"} to `, c.name];
  },
  "quote.option.choose": (c) => [`${c.actor} picked an option for `, c.name],
  "quote.option.client_choose": (c) => [`${c.name} picked `, "an option"],
  "quote.soft_hold.create": (c) => [`${c.actor} put an aircraft on hold for `, c.name],
  "quote.soft_hold.release": (c) => [`${c.actor} released a held aircraft for `, c.name],
  "quote.convert.trip": (c) => [`${c.actor} confirmed `, `${possessive(c.name)} booking`],
  "quote.reply_due_soon.notify": (c) => [`System warned the desk that `, `${possessive(c.name)} request`, " needs a reply soon"],

  // Trips
  "trip.create.from_quote": (c) => [`${c.actor} created `, `${possessive(c.name)} trip`],
  "trip.status.update": (c) => {
    const to = after(c.diff, "status");
    return [`${c.actor} marked `, `${possessive(c.name)} trip`, ` as ${to ? tripState(to).label : "updated"}`];
  },
  "trip.message.post": (c) => [`${c.actor} messaged ${c.name} about `, "the trip"],
  "trip.cancel.refund": (c) => [`${c.actor} cancelled `, `${possessive(c.name)} trip`, " and refunded the payment"],

  // Clients & memberships
  "member.invite": (c) => [`${c.actor} invited `, c.named ? c.name : "a client", " as a client"],
  "membership.activated": (c) => [`${possessive(c.name)} membership`, "", " is active"],
  "membership.activation.duplicate_refund_required": (c) => [`A duplicate membership payment from `, c.name, " needs a refund"],
  "membership.charter_draw": (c) => [`${c.actor} charged a charter to `, `${possessive(c.name)} reserve`],
  "membership.checkout.start": (c) => [c.name, "", " started a membership checkout"],
  "membership.topup.start": (c) => [c.name, "", " started a reserve top-up"],
  "membership.topup.completed": (c) => [c.name, "", " topped up the reserve"],
  "companion.create": (c) => [`${c.actor} added a travel companion for `, c.name],
  "companion.delete": (c) => [`${c.actor} removed a travel companion for `, c.name],
  "lane.create": (c) => [`${c.actor} added a usual route for `, c.name],
  "lane.delete": (c) => [`${c.actor} removed a usual route for `, c.name],

  // Money
  "invoice.checkout.start": (c) => `${c.name} started paying an invoice`,
  "invoice.checkout.resume": (c) => `${c.name} went back to pay an invoice`,
  "invoice.paid": (c) => `${c.name} paid an invoice`,
  "invoice.payment.failed": (c) => `${possessive(c.name)} card payment did not go through`,
  "invoice.overdue": (c) => `${possessive(c.name)} invoice went overdue`,
  "invoice.refund.card": (c) => `${c.actor} refunded ${possessive(c.name)} card`,
  "invoice.refund.card_failed": (c) => `A refund to ${c.name} did not go through`,
  "invoice.refunded": (c) => `${possessive(c.name)} invoice was refunded`,
  "invoice.refunded.partial": (c) => `${possessive(c.name)} invoice was partly refunded`,

  // Team
  "user_role.invite": (c) => [`${c.actor} invited `, str(c.meta?.name) ?? c.code ?? "someone", ` to the team as ${roleWords(str(c.meta?.role) ?? after(c.diff, "role"))}`],
  "user_role.update": (c) => [`${c.actor} made `, str(c.meta?.name) ?? c.code ?? "a teammate", ` ${roleWords(after(c.diff, "role"))}`],
  "user_role.remove": (c) => [`${c.actor} removed `, str(c.meta?.name) ?? c.code ?? "a teammate", " from the desk"],

  // Desk settings
  "system.reply_promise.update": (c) => {
    const to = after(c.diff, "minutes");
    return [`${c.actor} set `, "the reply-time promise", ` to ${to ?? "a new value"} minutes`];
  },

  // Reference data
  "operator.create": (c) => [`${c.actor} added `, "an operator"],
  "operator.update": (c) => [`${c.actor} updated `, "an operator"],
  "operator.contact.create": (c) => [`${c.actor} added a contact to `, "an operator"],
  "operator.contact.delete": (c) => [`${c.actor} removed a contact from `, "an operator"],
  "operator.contact.escalation.toggle": (c) => [`${c.actor} changed who gets escalations at `, "an operator"],
  "aircraft.create": (c) => [`${c.actor} added `, "an aircraft"],
  "aircraft.update": (c) => [`${c.actor} updated `, "an aircraft"],
  "airport.create": (c) => `${c.actor} added an airport`,
  "airport.update": (c) => `${c.actor} updated an airport`,
  "airport.delete": (c) => `${c.actor} removed an airport`,
  "fbo.create": (c) => `${c.actor} added an FBO`,
  "fbo.delete": (c) => `${c.actor} removed an FBO`,
  "schedule_block.create": (c) => `${c.actor} blocked time on the ops board`,
  "schedule_block.delete": (c) => `${c.actor} cleared a block on the ops board`,
  "empty_leg.create": (c) => [`${c.actor} posted `, "an empty leg"],
  "empty_leg.status.update": (c) => {
    const to = after(c.diff, "status");
    return [`${c.actor} marked `, "an empty leg", ` as ${to ? to.replace(/_/g, " ") : "updated"}`];
  },
  "empty_leg_watchlist.create": () => "Someone signed up for empty-leg alerts",
  "empty_leg_watchlist.delete": () => "Someone left the empty-leg alerts",
  "empty_leg_watchlist.toggle_active": () => "Someone paused or resumed their empty-leg alerts",
  "empty_leg_watchlist.match.notify": () => "System sent an empty-leg alert",
  "blog_subscriber.confirm": () => "A reader confirmed a blog subscription",
  "contact_inquiry.submit": (c) => [`${c.named ? c.name : "Someone"} sent `, "a message through the contact form"],
  "contact_inquiry.notify.email": (c) => [`System emailed the desk about `, "a contact message"],

  // AI
  "ai_provider.key.create": (c) => [`${c.actor} stored a key for `, "the phone answering AI"],
  "ai_provider.key.replace": (c) => [`${c.actor} replaced a key for `, "the phone answering AI"],
  "ai_provider.key.delete": (c) => [`${c.actor} removed a key from `, "the phone answering AI"],
  "ai_provider.settings.update": (c) => [`${c.actor} changed settings for `, "the phone answering AI"],
  "ai_provider.test": (c) => [`${c.actor} tested a key for `, "the phone answering AI"],
  "ai_route.update": (c) => [`${c.actor} changed which model answers `, "the phone"],
};

export function auditSentence(row: AuditSentenceRow): AuditSentence {
  const actor = actorName(row);
  const subjectName = row.subjectName?.trim() || null;
  const href = subjectHref(row.subjectType, row.subjectId);
  const ctx: Ctx = {
    actor,
    name: subjectName ?? "a client",
    named: Boolean(subjectName),
    code: row.subjectCode,
    diff: row.diff,
    meta: row.metadata,
    href,
  };

  const entry = VERBS[row.action];
  const ref = row.subjectType === "user_role" ? null : row.subjectCode;

  if (!entry) {
    const actionWords = row.action.replace(/[._]+/g, " ");
    const typeWords = SUBJECT_WORDS[row.subjectType] ?? row.subjectType.replace(/_/g, " ");
    if (!href) return { pre: `${actor} did ${actionWords} on ${typeWords}`, link: null, post: "", ref };
    return { pre: `${actor} did ${actionWords} on `, link: { label: typeWords, href }, post: "", ref };
  }

  const built = entry(ctx);
  if (typeof built === "string") return { pre: built, link: null, post: "", ref };
  const [pre, label, post = ""] = built;
  if (!label) return { pre: `${pre}${post}`, link: null, post: "", ref };
  // Without a page to link, keep the subject words inline.
  if (!href) return { pre: `${pre}${label}${post}`, link: null, post: "", ref };
  return { pre, link: { label, href }, post, ref };
}

// ─── When ───────────────────────────────────────────────────────────────

const LA = "America/Los_Angeles";
const DAY_KEY = new Intl.DateTimeFormat("en-CA", { timeZone: LA, year: "numeric", month: "2-digit", day: "2-digit" });
const CLOCK = new Intl.DateTimeFormat("en-US", { timeZone: LA, hour: "numeric", minute: "2-digit" });
const MONTH_DAY = new Intl.DateTimeFormat("en-US", { timeZone: LA, month: "short", day: "numeric" });
const MONTH_DAY_YEAR = new Intl.DateTimeFormat("en-US", { timeZone: LA, month: "short", day: "numeric", year: "numeric" });

/** "Today, 3:12 PM" / "Yesterday, 6:22 PM" / "Oct 1, 9:14 AM" in Los Angeles time. */
export function whenWords(d: Date, now = new Date()): string {
  const key = DAY_KEY.format(d);
  const today = DAY_KEY.format(now);
  const yesterday = DAY_KEY.format(new Date(now.getTime() - 86_400_000));
  const clock = CLOCK.format(d);
  if (key === today) return `Today, ${clock}`;
  if (key === yesterday) return `Yesterday, ${clock}`;
  const sameYear = key.slice(0, 4) === today.slice(0, 4);
  return `${(sameYear ? MONTH_DAY : MONTH_DAY_YEAR).format(d)}, ${clock}`;
}
