/**
 * Exercises the empty-leg watchlist matcher against the cases that
 * decide whether a real person gets a text. Pure module, no database —
 * run with `pnpm check:watchlist`.
 */
import {
  channelsFor,
  effectiveDiscountPct,
  endpointMatches,
  placeMatches,
  rejectionFor,
  smsBody,
  emailSubject,
  type MatchableLeg,
  type MatchableWatchlist,
} from "../src/lib/watchlist-matching.ts";
import { optOutKeyword } from "../src/lib/sms-optout.ts";
import { normalizeFreeformE164 } from "../src/lib/phone.ts";
import { confirmExpiry, hashToken, isExpired, issueToken } from "../src/lib/watchlist-confirm.ts";
import { validateWatchlistInput } from "../src/lib/watchlist-validation.ts";

const NOW = new Date("2026-09-08T12:00:00Z");

const leg = (over: Partial<MatchableLeg> = {}): MatchableLeg => ({
  id: "leg-1",
  code: "EL-2026-0001",
  category: "supermid",
  fromIcao: "KVNY",
  fromIata: "VNY",
  fromCity: "Los Angeles",
  fromName: "Van Nuys",
  toIcao: "KTEB",
  toIata: "TEB",
  toCity: "New York",
  toName: "Teterboro",
  wheelsUpAt: new Date("2026-09-12T15:00:00Z"),
  listedPriceUsd: 8400,
  fullCharterRefUsd: 18000,
  discountPct: 53,
  ...over,
});

const watch = (over: Partial<MatchableWatchlist> = {}): MatchableWatchlist => ({
  id: "w-1",
  email: null,
  phoneE164: "+14155551234",
  fromIcao: "KVNY",
  fromText: "KVNY",
  toIcao: "KTEB",
  toText: "KTEB",
  earliestOn: "2026-09-10",
  latestOn: "2026-09-20",
  minDiscountPct: 30,
  notifyChannels: { sms: true, email: false },
  active: true,
  smsConfirmedAt: new Date("2026-09-01T00:00:00Z"),
  emailConfirmedAt: null,
  ...over,
});

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ok   ${name}`);
  } else {
    console.log(`  FAIL ${name}\n         expected ${e}\n         actual   ${a}`);
    failures++;
  }
}

console.log("place matching");
check("exact city", placeMatches("Los Angeles", "los angeles"), true);
check("punctuation and case", placeMatches("Martha's Vineyard", "marthas vineyard"), true);
check("whole-word prefix", placeMatches("New York", "New York City"), true);
check("suffix word is not a match", placeMatches("York", "New York"), false);
check("abbreviation is not a match", placeMatches("LA", "Atlanta"), false);
check("different cities", placeMatches("Aspen", "Austin"), false);

console.log("endpoint matching");
check(
  "icao on the watchlist is authoritative",
  endpointMatches("KVNY", "anything", { icao: "KVNY", iata: "VNY", city: "Los Angeles", name: "Van Nuys" }),
  true,
);
check(
  "wrong icao does not match on city text",
  endpointMatches("KBUR", "Los Angeles", { icao: "KVNY", iata: "VNY", city: "Los Angeles", name: "Van Nuys" }),
  false,
);
check(
  "free-text city matches the leg city",
  endpointMatches(null, "Los Angeles", { icao: "KVNY", iata: "VNY", city: "Los Angeles", name: "Van Nuys" }),
  true,
);
check(
  "free-text iata matches",
  endpointMatches(null, "TEB", { icao: "KTEB", iata: "TEB", city: "New York", name: "Teterboro" }),
  true,
);
check(
  "free-text airport name matches",
  endpointMatches(null, "Teterboro", { icao: "KTEB", iata: "TEB", city: "New York", name: "Teterboro" }),
  true,
);
check(
  "unrelated text does not match",
  endpointMatches(null, "Miami", { icao: "KTEB", iata: "TEB", city: "New York", name: "Teterboro" }),
  false,
);

console.log("discount");
check("explicit discount wins", effectiveDiscountPct(leg({ discountPct: 41 })), 41);
check(
  "null discount falls back to the price arithmetic",
  effectiveDiscountPct(leg({ discountPct: null, listedPriceUsd: 9000, fullCharterRefUsd: 18000 })),
  50,
);
check(
  "null discount with no reference price is zero, not negative",
  effectiveDiscountPct(leg({ discountPct: null, fullCharterRefUsd: 0 })),
  0,
);

console.log("channels");
check("sms when a phone is present", channelsFor(watch()), ["sms"]);
check(
  "both when opted in, addressable and confirmed",
  channelsFor(
    watch({
      email: "a@b.com",
      notifyChannels: { sms: true, email: true },
      emailConfirmedAt: new Date("2026-09-01T00:00:00Z"),
    }),
  ),
  ["sms", "email"],
);
check(
  "an unconfirmed email is not sent to, even when opted in",
  channelsFor(watch({ email: "a@b.com", notifyChannels: { sms: true, email: true } })),
  ["sms"],
);
check(
  "an unconfirmed phone is silent",
  channelsFor(watch({ smsConfirmedAt: null })),
  [],
);
check(
  "no channel when the address is missing",
  channelsFor(watch({ phoneE164: null, notifyChannels: { sms: true, email: true } })),
  [],
);
check(
  "legacy row with no preferences still gets sms once confirmed",
  channelsFor(watch({ notifyChannels: null })),
  ["sms"],
);

console.log("match rules");
check("the happy path matches", rejectionFor(watch(), leg(), NOW), null);
check("inactive watchlist", rejectionFor(watch({ active: false }), leg(), NOW), "inactive");
check(
  "no reachable channel",
  rejectionFor(watch({ phoneE164: null, email: null }), leg(), NOW),
  "no-channel",
);
check(
  "an address that never confirmed reads as unconfirmed, not no-channel",
  rejectionFor(watch({ smsConfirmedAt: null }), leg(), NOW),
  "unconfirmed",
);
check(
  "departed leg",
  rejectionFor(watch(), leg({ wheelsUpAt: new Date("2026-09-08T11:00:00Z") }), NOW),
  "departed",
);
check("wrong destination", rejectionFor(watch({ toIcao: "KMIA", toText: "KMIA" }), leg(), NOW), "route");
check(
  "before the window",
  rejectionFor(watch({ earliestOn: "2026-09-15" }), leg(), NOW),
  "window",
);
check("after the window", rejectionFor(watch({ latestOn: "2026-09-11" }), leg(), NOW), "window");
check(
  "window boundaries are inclusive",
  rejectionFor(watch({ earliestOn: "2026-09-12", latestOn: "2026-09-12" }), leg(), NOW),
  null,
);
check(
  "an open window matches any date",
  rejectionFor(watch({ earliestOn: null, latestOn: null }), leg(), NOW),
  null,
);
check(
  "discount below the floor",
  rejectionFor(watch({ minDiscountPct: 60 }), leg({ discountPct: 53 }), NOW),
  "discount",
);
check(
  "discount exactly at the floor",
  rejectionFor(watch({ minDiscountPct: 53 }), leg({ discountPct: 53 }), NOW),
  null,
);
check(
  "city watchlist matches a leg from that city's field",
  rejectionFor(
    watch({ fromIcao: null, fromText: "Los Angeles", toIcao: null, toText: "New York" }),
    leg(),
    NOW,
  ),
  null,
);

console.log("message copy");
const body = smsBody(leg(), "https://jetnine.com");
check("sms carries an opt-out", /reply STOP/i.test(body), true);
check("sms names the route", body.includes("VNY → TEB"), true);
check("sms fits one concatenated message", body.length <= 320, true);
check(
  "email subject carries the discount",
  emailSubject(leg()).includes("53% off"),
  true,
);
console.log(`\n  sms preview: ${body}\n  (${body.length} chars)`);

console.log("carrier keywords");
check("bare stop", optOutKeyword("STOP"), "stop");
check("lowercase with punctuation", optOutKeyword("stop."), "stop");
check("padded", optOutKeyword("  Stop  "), "stop");
check("stopall", optOutKeyword("STOPALL"), "stop");
check("unsubscribe", optOutKeyword("unsubscribe"), "stop");
check("cancel", optOutKeyword("Cancel"), "stop");
check("start resumes", optOutKeyword("START"), "start");
check("unstop resumes", optOutKeyword("unstop"), "start");
check("help", optOutKeyword("HELP"), "help");
check("a sentence containing stop is a human reply", optOutKeyword("please stop texting me"), null);
check("a real reply", optOutKeyword("Can you hold that Vegas leg?"), null);
check("empty body", optOutKeyword("   "), null);

console.log("phone normalization");
check("already e164", normalizeFreeformE164("+14155551234"), "+14155551234");
check("e164 with spacing", normalizeFreeformE164("+1 415 555 1234"), "+14155551234");
check("international with punctuation", normalizeFreeformE164("+44 (0)20 7946 0958"), "+4402079460958");
check("bare ten-digit is treated as NANP", normalizeFreeformE164("(415) 555-1234"), "+14155551234");
check("bare eleven-digit starting 1", normalizeFreeformE164("1-415-555-1234"), "+14155551234");
check("bare nine-digit is refused, not guessed", normalizeFreeformE164("415555123"), null);
check("bare twelve-digit is refused, not guessed", normalizeFreeformE164("442079460958"), null);
// Known limitation, documented in phone.ts and signposted on the form:
// ten bare digits are read as NANP, so a London number typed without its
// country code lands in Maine.
check("bare ten-digit foreign number is read as NANP", normalizeFreeformE164("20 7946 0958"), "+12079460958");
check("the same number with its country code is preserved", normalizeFreeformE164("+44 20 7946 0958"), "+442079460958");
check("letters only", normalizeFreeformE164("call me"), null);
check("empty", normalizeFreeformE164("   "), null);
check("leading zero after + is not valid e164", normalizeFreeformE164("+0155551234"), null);

console.log("watchlist input stores a textable number");
const okInput = validateWatchlistInput(
  { from: "KVNY", to: "KTEB", earliest: "2026-09-10", latest: "2026-09-20", mobile: "(415) 555-1234" },
  new Date("2026-09-08T12:00:00Z"),
);
check("a US number typed with punctuation is accepted", okInput.ok, true);
check(
  "and is stored in the form Twilio and the STOP lookup expect",
  okInput.ok ? okInput.value.mobile : null,
  "+14155551234",
);
const badInput = validateWatchlistInput(
  { from: "KVNY", to: "KTEB", earliest: "2026-09-10", latest: "2026-09-20", mobile: "7946 0958" },
  new Date("2026-09-08T12:00:00Z"),
);
check(
  "a number of no recognisable shape is refused rather than guessed",
  badInput.ok ? null : badInput.errors,
  ["mobile-country-code"],
);
check(
  "an over-long email is refused",
  (() => {
    const r = validateWatchlistInput(
      {
        from: "KVNY", to: "KTEB", earliest: "2026-09-10", latest: "2026-09-20",
        mobile: "+14155551234", email: `${"a".repeat(250)}@example.com`,
      },
      new Date("2026-09-08T12:00:00Z"),
    );
    return r.ok ? null : r.errors;
  })(),
  ["email-too-long"],
);

console.log("confirmation tokens");
const t1 = issueToken();
const t2 = issueToken();
check("tokens are url-safe", /^[A-Za-z0-9_-]+$/.test(t1.token), true);
check("tokens are long", t1.token.length >= 40, true);
check("tokens are unique", t1.token === t2.token, false);
check("the stored value is a hash, not the token", t1.hash === t1.token, false);
check("hashing is deterministic", hashToken(t1.token), t1.hash);
check("a different token hashes differently", hashToken(t2.token) === t1.hash, false);
check(
  "a fresh token has not expired",
  isExpired(confirmExpiry(new Date("2026-09-08T12:00:00Z")), new Date("2026-09-08T12:00:00Z")),
  false,
);
check(
  "expiry lands 48h out",
  isExpired(confirmExpiry(new Date("2026-09-08T12:00:00Z")), new Date("2026-09-10T12:00:01Z")),
  true,
);
check("a missing expiry counts as expired", isExpired(null), true);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
