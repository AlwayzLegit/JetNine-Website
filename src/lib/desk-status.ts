/**
 * Plain-words status dictionary for the dispatch desk (Phase 5 of the
 * simplification). The database keeps its enums; the desk renders these
 * sentences. Shared by every admin section so a request reads the same way
 * in the Requests list, the one-request page, Messages and Clients.
 */

// ─── Requests (quotes) ──────────────────────────────────────────────────

export type RequestStageKey = "reply" | "working" | "sent" | "booked" | "closed";

export type RequestStageInfo = {
  key: RequestStageKey;
  /** Sentence shown next to the dot. */
  label: string;
  /** Group heading in the Requests list. */
  group: string;
  dot: "gold" | "steel" | "success" | "danger";
};

const REQUEST_STAGES: Record<string, RequestStageInfo> = {
  draft: { key: "reply", label: "Needs a reply", group: "Needs a reply", dot: "gold" },
  submitted: { key: "reply", label: "Needs a reply", group: "Needs a reply", dot: "gold" },
  triaged: { key: "working", label: "Working on it", group: "Working on it", dot: "steel" },
  sourcing: { key: "working", label: "Working on it", group: "Working on it", dot: "steel" },
  options_sent: {
    key: "sent",
    label: "Options sent",
    group: "Options sent · waiting on the client",
    dot: "steel",
  },
  held: {
    key: "sent",
    label: "Options sent · aircraft held",
    group: "Options sent · waiting on the client",
    dot: "steel",
  },
  accepted: { key: "booked", label: "Client picked an option", group: "Booked", dot: "success" },
  converted: { key: "booked", label: "Booked · now under Trips", group: "Booked", dot: "success" },
  declined: { key: "closed", label: "Client went elsewhere", group: "Closed", dot: "steel" },
  expired: { key: "closed", label: "Expired without a reply", group: "Closed", dot: "steel" },
  cancelled: { key: "closed", label: "Cancelled", group: "Closed", dot: "steel" },
};

export function requestStage(status: string): RequestStageInfo {
  return REQUEST_STAGES[status] ?? { key: "closed", label: status.replace(/_/g, " "), group: "Closed", dot: "steel" };
}

/** Tabs on the Requests list, in order. `all` is appended by the page. */
export const REQUEST_TABS: { key: RequestStageKey; label: string }[] = [
  { key: "reply", label: "Needs a reply" },
  { key: "working", label: "Working on it" },
  { key: "sent", label: "Options sent" },
  { key: "booked", label: "Booked" },
];

/** Statuses that still count as "open" on the desk. */
export const OPEN_REQUEST_STATUSES = ["submitted", "triaged", "sourcing", "options_sent", "held"] as const;

/**
 * The due line under "Received 12 min ago". Returns null once the request
 * no longer waits on the desk (options sent, booked, closed).
 */
export function replyDueLine(
  deadline: Date | null | undefined,
  status: string,
  now = new Date(),
): { text: string; tone: "gold" | "danger" | "steel" } | null {
  const stage = requestStage(status).key;
  if (stage !== "reply" && stage !== "working") return null;
  if (!deadline) return null;
  const minutes = Math.round((deadline.getTime() - now.getTime()) / 60_000);
  if (minutes < 0) return { text: `Reply overdue by ${minutesWords(-minutes)}`, tone: "danger" };
  if (minutes === 0) return { text: "Reply due now", tone: "gold" };
  return { text: `Reply due in ${minutesWords(minutes)}`, tone: "gold" };
}

export function minutesWords(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m ? `${h} h ${m} min` : `${h} h`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"}`;
}

/**
 * The client-facing reply promise in words, from the desk setting
 * (`getReplyPromiseMinutes`): 60 → "within an hour", otherwise
 * "within 30 minutes". Pure, so client components can use it with a prop.
 */
export function replyPromiseWords(minutes: number | null | undefined = 30): string {
  const m = minutes && Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 30;
  if (m === 60) return "within an hour";
  return `within ${m} minutes`;
}

// ─── Trips ──────────────────────────────────────────────────────────────

export type TripStateInfo = {
  label: string;
  dot: "gold" | "steel" | "success" | "danger";
  /** Upcoming / Past bucket for the Trips list. */
  bucket: "upcoming" | "past";
};

const TRIP_STATES: Record<string, TripStateInfo> = {
  draft: { label: "Being set up", dot: "steel", bucket: "upcoming" },
  confirmed: { label: "Confirmed", dot: "success", bucket: "upcoming" },
  crew_briefed: { label: "Confirmed · crew briefed", dot: "success", bucket: "upcoming" },
  boarding: { label: "Boarding", dot: "gold", bucket: "upcoming" },
  airborne: { label: "In the air", dot: "success", bucket: "upcoming" },
  wheels_down: { label: "Landed", dot: "steel", bucket: "past" },
  completed: { label: "Flown", dot: "steel", bucket: "past" },
  cancelled_wx: { label: "Cancelled · weather", dot: "danger", bucket: "past" },
  cancelled_other: { label: "Cancelled", dot: "danger", bucket: "past" },
  diverted: { label: "Diverted", dot: "gold", bucket: "upcoming" },
  irregular_ops: { label: "Needs attention", dot: "danger", bucket: "upcoming" },
};

export function tripState(status: string): TripStateInfo {
  return TRIP_STATES[status] ?? { label: status.replace(/_/g, " "), dot: "steel", bucket: "past" };
}

// ─── Invoices ───────────────────────────────────────────────────────────

export function invoiceWords(
  status: string,
  dueOn: string | null | undefined,
  now = new Date(),
): { text: string; tone: "gold" | "danger" | "steel" | "success" } {
  switch (status) {
    case "paid":
      return { text: "Paid", tone: "success" };
    case "due": {
      if (dueOn) {
        const days = Math.ceil((new Date(dueOn + "T00:00:00Z").getTime() - now.getTime()) / 86_400_000);
        if (days < 0) return { text: `Overdue by ${-days} day${days === -1 ? "" : "s"}`, tone: "danger" };
        if (days === 0) return { text: "Due today", tone: "gold" };
        return { text: `Due in ${days} day${days === 1 ? "" : "s"}`, tone: "gold" };
      }
      return { text: "Due", tone: "gold" };
    }
    case "overdue":
      return { text: "Overdue", tone: "danger" };
    case "draft":
      return { text: "Invoice not sent yet", tone: "steel" };
    case "void":
      return { text: "Voided", tone: "steel" };
    case "refunded":
      return { text: "Refunded", tone: "steel" };
    default:
      return { text: status.replace(/_/g, " "), tone: "steel" };
  }
}

// ─── Memberships ────────────────────────────────────────────────────────

export const TIER_WORDS: Record<string, string> = {
  on_demand: "No membership",
  card_100: "JetNine Card · 100 hours",
  card_250: "JetNine Card · 250 hours",
  card_500: "JetNine Card · 500 hours",
  reserve_50: "Reserve · $50k",
  reserve_100: "Reserve · $100k",
  reserve_250: "Reserve · $250k",
  reserve_500_apply: "Reserve · $500k (applying)",
};

export function tierWords(tier: string | null | undefined): string {
  if (!tier) return "No membership";
  return TIER_WORDS[tier] ?? tier.replace(/_/g, " ");
}

export function isCardOrReserve(tier: string | null | undefined): boolean {
  return Boolean(tier && tier !== "on_demand");
}

// ─── People ─────────────────────────────────────────────────────────────

export function personName(
  first: string | null | undefined,
  last: string | null | undefined,
  fallback = "No name yet",
): string {
  const n = `${first ?? ""} ${last ?? ""}`.trim();
  return n || fallback;
}

export function initialOf(name: string): string {
  const c = name.trim()[0];
  return c ? c.toUpperCase() : "?";
}

export function passengersWords(n: number | null | undefined): string {
  if (!n) return "passengers not set";
  return `${n} passenger${n === 1 ? "" : "s"}`;
}

/** "Alex is on it" for a staff display name, or null. */
export function onItWords(displayName: string | null | undefined): string | null {
  return displayName ? `${displayName.split(" ")[0]} is on it` : null;
}

// ─── Team roles (Settings › Team) ───────────────────────────────────────

export type DeskRole = "owner" | "team";

/** DB roles that may open the desk, mapped to the two words the desk uses. */
export function deskRole(role: string): DeskRole | null {
  if (role === "admin" || role === "superadmin") return "owner";
  if (role === "dispatcher") return "team";
  return null;
}

export const DESK_ROLE_WORDS: Record<DeskRole, { label: string; can: string }> = {
  owner: { label: "Owner", can: "Everything, including reports and money" },
  team: { label: "Team", can: "Requests, trips, clients, messages" },
};
