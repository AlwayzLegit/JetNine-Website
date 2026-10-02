// Plain-words status for a member's quote requests — shared by the account
// overview and /account/quotes so the two pages never disagree. Dispatch
// jargon (triaged, sourcing, held) is translated into a sentence the client
// can act on; the tone drives the dot colour (gold = in progress, success =
// chosen/booked, steel = closed).

import { replyPromiseWords } from "@/lib/desk-status";

export type StatusTone = "gold" | "success" | "steel";

export type StatusWords = { text: string; tone: StatusTone };

/** Statuses the overview counts as "in progress". */
export const QUOTE_IN_PROGRESS = [
  "submitted",
  "triaged",
  "sourcing",
  "options_sent",
  "held",
  "accepted",
] as const;

const CLOCK_LA = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Los_Angeles",
});
const DAY_LA = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  timeZone: "America/Los_Angeles",
});
const ISO_LA = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "America/Los_Angeles",
});

/** Today's calendar date (YYYY-MM-DD) on the dispatch desk's clock. */
export function todayISO(now = new Date()): string {
  return ISO_LA.format(now);
}

/** "3:40 PM today" or "Fri 3:40 PM" for a response deadline. */
function deadlineWords(at: Date, now: Date): string {
  const clock = CLOCK_LA.format(at);
  return ISO_LA.format(at) === ISO_LA.format(now) ? `${clock} today` : `${DAY_LA.format(at)} ${clock}`;
}

export function quoteStatusWords(
  status: string,
  slaDeadlineAt: Date | null | undefined,
  now = new Date(),
  /** Reply-time promise from the desk setting (`getReplyPromiseMinutes`). Default 30. */
  replyMinutes = 30,
): StatusWords {
  switch (status) {
    case "draft":
      return { text: "Not sent yet", tone: "steel" };
    case "submitted":
    case "triaged":
      return { text: `Received — dispatch picks it up ${replyPromiseWords(replyMinutes)}`, tone: "gold" };
    case "sourcing":
      if (slaDeadlineAt && slaDeadlineAt.getTime() > now.getTime()) {
        return {
          text: `Dispatch is sourcing aircraft — options by ${deadlineWords(slaDeadlineAt, now)}`,
          tone: "gold",
        };
      }
      return { text: "Dispatch is sourcing aircraft — options are on their way", tone: "gold" };
    case "options_sent":
    case "held":
      return { text: "Your options are ready — pick one", tone: "gold" };
    case "accepted":
      return { text: "You chose an aircraft — confirming the booking", tone: "success" };
    case "converted":
      return { text: "Booked — see it under your trips", tone: "success" };
    case "declined":
      return { text: "Closed without a booking", tone: "steel" };
    case "expired":
      return { text: "Closed — the options expired before one was chosen", tone: "steel" };
    case "cancelled":
      return { text: "Cancelled", tone: "steel" };
    default:
      return { text: "With dispatch", tone: "gold" };
  }
}

export function dotClass(tone: StatusTone): string {
  return tone === "gold" ? "dot dot-gold" : tone === "success" ? "dot dot-success" : "dot";
}

/** "one", "two" … up to nine, digits after that. */
export function countWords(n: number): string {
  const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
  return words[n] ?? String(n);
}
