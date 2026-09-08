/**
 * Carrier opt-out keywords for inbound SMS.
 *
 * Twilio enforces these at the account level: once someone texts STOP,
 * Twilio blocks further outbound to that number whether or not our own
 * records agree. This module exists so our records do agree — an
 * empty-leg watchlist that stays `active` after a STOP would keep
 * showing up in the matcher, keep claiming ledger rows, and would
 * silently resume the moment the number moved to a new sender.
 *
 * Keyword sets follow Twilio's documented defaults. Matching is on the
 * whole message after stripping case, whitespace and punctuation, which
 * is how the carriers do it: "stop." opts out, "please stop texting me"
 * does not (a human reads that one).
 */

export type OptOutKeyword = "stop" | "start" | "help";

const STOP_WORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit"]);
const START_WORDS = new Set(["start", "yes", "unstop"]);
const HELP_WORDS = new Set(["help", "info"]);

/** The carrier keyword this message is, or null when it is a real reply. */
export function optOutKeyword(body: string): OptOutKeyword | null {
  const word = body
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (!word) return null;
  if (STOP_WORDS.has(word)) return "stop";
  if (START_WORDS.has(word)) return "start";
  if (HELP_WORDS.has(word)) return "help";
  return null;
}

/** Reason stamped on a watchlist deactivated by an inbound STOP. */
export const DEACTIVATED_BY_SMS_STOP = "sms_stop";
