import { CATEGORY_LABELS, formatUSD, type EmptyLegView } from "@/lib/empty-legs";
import { SITE } from "@/lib/constants";

/**
 * Empty-leg watchlist matching.
 *
 * Pure by design: no database, no network, no clock of its own — the
 * caller passes `now`. That is what lets scripts/check-watchlist-matching.mts
 * exercise every rule without a connection, and it keeps the cron route
 * (src/app/api/cron/empty-leg-watchlists/route.ts) down to plumbing.
 *
 * The board promises "1 SMS per match" and matching "every fifteen
 * minutes". This module decides what a match is; the ledger table
 * (empty_leg_watchlist_matches) guarantees the "1".
 */

export type MatchableLeg = {
  id: string;
  code: string;
  category: EmptyLegView["category"] | string;
  fromIcao: string;
  fromIata: string | null;
  fromCity: string | null;
  fromName: string | null;
  toIcao: string;
  toIata: string | null;
  toCity: string | null;
  toName: string | null;
  wheelsUpAt: Date;
  listedPriceUsd: number;
  fullCharterRefUsd: number;
  discountPct: number | null;
};

export type MatchableWatchlist = {
  id: string;
  email: string | null;
  phoneE164: string | null;
  fromIcao: string | null;
  fromText: string | null;
  toIcao: string | null;
  toText: string | null;
  earliestOn: string | null;
  latestOn: string | null;
  minDiscountPct: number;
  notifyChannels: { email?: boolean; sms?: boolean } | null;
  active: boolean;
  /** Confirmed opt-in, per channel. See src/lib/watchlist-confirm.ts. */
  smsConfirmedAt: Date | null;
  emailConfirmedAt: Date | null;
  /** Minted by the database; written into every alert email. */
  unsubscribeToken: string;
};

export type MatchChannel = "sms" | "email";

/**
 * Discount the board would show. `discount_pct` is nullable on the table
 * and legs priced by hand often leave it empty, so fall back to the same
 * arithmetic the board uses rather than treating null as zero — treating
 * it as zero would silently withhold every alert on a hand-priced leg.
 */
export function effectiveDiscountPct(leg: MatchableLeg): number {
  if (typeof leg.discountPct === "number") return leg.discountPct;
  if (leg.fullCharterRefUsd <= 0) return 0;
  const pct = Math.round((1 - leg.listedPriceUsd / leg.fullCharterRefUsd) * 100);
  return Math.max(0, Math.min(99, pct));
}

/** Wheels-up day in UTC, as YYYY-MM-DD, to compare against the window. */
export function legDateUtc(leg: MatchableLeg): string {
  return leg.wheelsUpAt.toISOString().slice(0, 10);
}

function normalizePlace(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Two place strings refer to the same place. Exact after normalizing, or
 * one is a whole-word prefix of the other so "New York" still matches a
 * leg whose city is recorded as "New York City". Deliberately not a
 * substring test: "York" must not match "New York", and a bare "LA" must
 * not match "Atlanta".
 */
export function placeMatches(a: string, b: string): boolean {
  const x = normalizePlace(a);
  const y = normalizePlace(b);
  if (!x || !y) return false;
  if (x === y) return true;
  return x.startsWith(`${y} `) || y.startsWith(`${x} `);
}

/**
 * One end of the route matches. An ICAO on the watchlist is authoritative
 * and compared strictly — src/lib/watchlist-validation.ts only stores one
 * when the airport table resolved the text unambiguously. Otherwise the
 * free text is compared against every label the leg carries, so a
 * watchlist for "Los Angeles" matches a leg out of Van Nuys whose city is
 * Los Angeles.
 */
export function endpointMatches(
  watchIcao: string | null,
  watchText: string | null,
  leg: { icao: string; iata: string | null; city: string | null; name: string | null },
): boolean {
  if (watchIcao) return watchIcao.toUpperCase() === leg.icao.toUpperCase();
  if (!watchText) return false;
  const candidates = [leg.icao, leg.iata, leg.city, leg.name].filter(
    (c): c is string => typeof c === "string" && c.length > 0,
  );
  return candidates.some((c) => placeMatches(watchText, c));
}

/**
 * Channels this watchlist can be sent on: requested, addressable, and
 * confirmed. The confirmation timestamp is the one that matters — the
 * form cannot prove the person filling it in owns the number they typed,
 * so an unconfirmed channel stays silent no matter what else is set.
 */
export function channelsFor(w: MatchableWatchlist): MatchChannel[] {
  const out: MatchChannel[] = [];
  // notifyChannels is nullable on rows created before the column existed;
  // a watchlist with a phone and no explicit preference still wants SMS,
  // which is the only thing the form ever promised.
  const wantsSms = w.notifyChannels?.sms ?? true;
  const wantsEmail = w.notifyChannels?.email ?? false;
  if (wantsSms && w.phoneE164 && w.smsConfirmedAt) out.push("sms");
  if (wantsEmail && w.email && w.emailConfirmedAt) out.push("email");
  return out;
}

export type MatchRejection =
  | "inactive"
  | "unconfirmed"
  | "no-channel"
  | "departed"
  | "route"
  | "window"
  | "discount";

/**
 * Why this leg is not a match, or null when it is. Returning the reason
 * rather than a bare boolean is what makes the check script and the cron
 * log useful when someone asks why they were not texted.
 */
export function rejectionFor(
  w: MatchableWatchlist,
  leg: MatchableLeg,
  now: Date,
): MatchRejection | null {
  if (!w.active) return "inactive";
  if (channelsFor(w).length === 0) {
    // Distinguished so "why was I not texted" has an answer: an address
    // that never confirmed is a different problem from no address.
    return w.phoneE164 || w.email ? "unconfirmed" : "no-channel";
  }
  if (leg.wheelsUpAt.getTime() <= now.getTime()) return "departed";

  const from = endpointMatches(w.fromIcao, w.fromText, {
    icao: leg.fromIcao,
    iata: leg.fromIata,
    city: leg.fromCity,
    name: leg.fromName,
  });
  const to = endpointMatches(w.toIcao, w.toText, {
    icao: leg.toIcao,
    iata: leg.toIata,
    city: leg.toCity,
    name: leg.toName,
  });
  if (!from || !to) return "route";

  // ISO dates compare correctly as strings.
  const day = legDateUtc(leg);
  if (w.earliestOn && day < w.earliestOn) return "window";
  if (w.latestOn && day > w.latestOn) return "window";

  if (effectiveDiscountPct(leg) < w.minDiscountPct) return "discount";
  return null;
}

export function matches(w: MatchableWatchlist, leg: MatchableLeg, now: Date): boolean {
  return rejectionFor(w, leg, now) === null;
}

// ─── Message copy ────────────────────────────────────────────────────────

const dayFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function routeLabel(leg: MatchableLeg): string {
  return `${leg.fromIata ?? leg.fromIcao} → ${leg.toIata ?? leg.toIcao}`;
}

function categoryLabel(leg: MatchableLeg): string {
  return (
    CATEGORY_LABELS[leg.category as EmptyLegView["category"]] ?? String(leg.category)
  );
}

/**
 * One SMS, one match. Ends with STOP wording because carriers require an
 * opt-out on recurring automated messaging.
 */
export function smsBody(leg: MatchableLeg, siteUrl: string): string {
  const pct = effectiveDiscountPct(leg);
  return (
    `JetNine: empty leg match. ${routeLabel(leg)} ${dayFmt.format(leg.wheelsUpAt)}, ` +
    `${categoryLabel(leg).toLowerCase()}, ${formatUSD(leg.listedPriceUsd)} (${pct}% off). ` +
    `First call wins: ${SITE.dispatchPhone}. ${siteUrl}/empty-legs · reply STOP to end alerts.`
  );
}

export function emailSubject(leg: MatchableLeg): string {
  return `Empty leg match: ${routeLabel(leg)} · ${dayFmt.format(leg.wheelsUpAt)} · ${effectiveDiscountPct(leg)}% off`;
}

export function emailBody(
  leg: MatchableLeg,
  siteUrl: string,
  unsubscribeUrl: string,
): { html: string; text: string } {
  const pct = effectiveDiscountPct(leg);
  const price = formatUSD(leg.listedPriceUsd);
  const was = formatUSD(leg.fullCharterRefUsd);
  const when = dayFmt.format(leg.wheelsUpAt);
  const cat = categoryLabel(leg);
  const board = `${siteUrl}/empty-legs`;

  const text =
    `A leg on your watchlist just hit the board.\n\n` +
    `${routeLabel(leg)} · ${when}\n${cat} · ${price} (was ${was}, ${pct}% off)\nLeg ${leg.code}\n\n` +
    `Empty legs are not held — first call wins. Call dispatch on ${SITE.dispatchPhone} ` +
    `and quote leg ${leg.code}, or see the board: ${board}\n\n` +
    `You are getting this because you confirmed an empty-leg watchlist at jetnine.com.\n` +
    `Stop these emails: ${unsubscribeUrl}`;

  const html =
    `<p>A leg on your watchlist just hit the board.</p>` +
    `<p><strong>${routeLabel(leg)}</strong> &middot; ${when}<br>` +
    `${cat} &middot; <strong>${price}</strong> (was ${was}, ${pct}% off)<br>` +
    `Leg ${leg.code}</p>` +
    `<p>Empty legs are not held &mdash; first call wins. Call dispatch on ` +
    `<a href="tel:${SITE.dispatchPhoneE164}">${SITE.dispatchPhone}</a> and quote leg ${leg.code}, ` +
    `or <a href="${board}">see the board</a>.</p>` +
    `<p style="color:#666;font-size:13px">You are getting this because you confirmed an ` +
    `empty-leg watchlist at jetnine.com. ` +
    `<a href="${unsubscribeUrl}">Stop these emails</a>.</p>`;

  return { html, text };
}
