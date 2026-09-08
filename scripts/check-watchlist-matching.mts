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
  "both when opted in and addressable",
  channelsFor(watch({ email: "a@b.com", notifyChannels: { sms: true, email: true } })),
  ["sms", "email"],
);
check(
  "no channel when the address is missing",
  channelsFor(watch({ phoneE164: null, notifyChannels: { sms: true, email: true } })),
  [],
);
check(
  "legacy row with no preferences still gets sms",
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

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
