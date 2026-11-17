import test from "node:test";
import assert from "node:assert/strict";
import {
  FALLBACK_ORIGIN,
  TTL_MS,
  expiryFor,
  hashToken,
  isPurpose,
  isUsable,
  linkFor,
  linkOrigin,
  looksLikeToken,
  newToken,
  safeNextPath,
} from "./core.mjs";

const T0 = new Date("2026-11-16T12:00:00Z");
const at = (ms) => new Date(T0.getTime() + ms);

test("each purpose has its own lifetime", () => {
  assert.equal(TTL_MS.signin, 15 * 60 * 1000);
  assert.equal(TTL_MS.reset, 30 * 60 * 1000);
  assert.equal(TTL_MS.invite, 7 * 24 * 60 * 60 * 1000);
  assert.equal(expiryFor("signin", T0).getTime(), at(TTL_MS.signin).getTime());
  assert.equal(expiryFor("reset", T0).getTime(), at(TTL_MS.reset).getTime());
  assert.equal(expiryFor("invite", T0).getTime(), at(TTL_MS.invite).getTime());
});

test("an unknown purpose is refused", () => {
  for (const bad of ["", "admin", "SIGNIN", null, undefined, 3]) {
    assert.equal(isPurpose(bad), false);
  }
  assert.throws(() => expiryFor("admin", T0));
  assert.throws(() => linkFor("https://jetnine.com", newToken(), "admin"));
});

test("a fresh unused row is usable, an expired or used one is not", () => {
  const fresh = { usedAt: null, expiresAt: at(TTL_MS.signin) };
  assert.equal(isUsable(fresh, T0), true);
  assert.equal(isUsable(fresh, at(TTL_MS.signin - 1)), true);
  assert.equal(isUsable(fresh, at(TTL_MS.signin)), false);
  assert.equal(isUsable(fresh, at(TTL_MS.signin + 1000)), false);
  assert.equal(isUsable({ usedAt: at(5), expiresAt: at(TTL_MS.signin) }, T0), false);
  assert.equal(isUsable({ usedAt: null, expiresAt: "not a date" }, T0), false);
  assert.equal(isUsable(null, T0), false);
  assert.equal(isUsable(undefined, T0), false);
});

test("a token is 43 base64url characters and anything else is refused", () => {
  assert.equal(looksLikeToken(newToken()), true);
  for (const bad of [undefined, null, "", "short", "a".repeat(44), "a".repeat(42) + "!", 12345]) {
    assert.equal(looksLikeToken(bad), false);
  }
});

test("the stored form is a hash, not the token", () => {
  const t = newToken();
  const h = hashToken(t);
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.notEqual(h, t);
  assert.equal(hashToken(t), h);
});

test("linkFor builds the link from the origin, token and purpose", () => {
  const t = newToken();
  const link = new URL(linkFor("https://jetnine.com", t, "reset"));
  assert.equal(link.origin, "https://jetnine.com");
  assert.equal(link.pathname, "/auth/link");
  assert.equal(link.searchParams.get("t"), t);
  assert.equal(link.searchParams.get("p"), "reset");
  assert.equal(link.searchParams.has("next"), false);
});

test("linkFor keeps a same-site next and drops anything that leaves the site", () => {
  const t = newToken();
  assert.equal(new URL(linkFor("https://jetnine.com", t, "signin", "/account/trips")).searchParams.get("next"), "/account/trips");
  for (const evil of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "evil"]) {
    const link = new URL(linkFor("https://jetnine.com", t, "signin", evil));
    assert.equal(link.searchParams.has("next"), false, evil);
    assert.equal(link.origin, "https://jetnine.com");
  }
  assert.equal(safeNextPath("//evil.example"), "/account");
  assert.equal(safeNextPath("/admin"), "/admin");
  assert.equal(safeNextPath(null), "/account");
});

test("linkFor refuses a token that could not have come from newToken", () => {
  assert.throws(() => linkFor("https://jetnine.com", "short", "signin"));
  assert.throws(() => linkFor("https://jetnine.com", hashToken(newToken()), "signin"));
});

test("the link never contains the stored hash", () => {
  const t = newToken();
  assert.equal(linkFor("https://jetnine.com", t, "invite").includes(hashToken(t)), false);
});

test("the origin comes from the configured site URL, never a host header, with a fallback", () => {
  assert.equal(linkOrigin("https://staging.jetnine.com"), "https://staging.jetnine.com");
  assert.equal(linkOrigin("https://staging.jetnine.com/some/path?x=1"), "https://staging.jetnine.com");
  for (const bad of [undefined, null, "", "   ", "not a url", "javascript:alert(1)", "ftp://x.example"]) {
    assert.equal(linkOrigin(bad), FALLBACK_ORIGIN, String(bad));
  }
  const link = new URL(linkFor(undefined, newToken(), "signin"));
  assert.equal(link.origin, FALLBACK_ORIGIN);
});
