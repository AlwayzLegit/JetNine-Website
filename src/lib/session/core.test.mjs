import test from "node:test";
import assert from "node:assert/strict";
import {
  ABSOLUTE_MS,
  COOKIE_NAME,
  IDLE_MS,
  TOUCH_MS,
  cookieOptions,
  expiryFrom,
  hashToken,
  isExpired,
  looksLikeToken,
  newToken,
  shouldTouch,
} from "./core.mjs";

const T0 = new Date("2026-11-16T12:00:00Z");
const at = (ms) => new Date(T0.getTime() + ms);

test("newToken is 256 bits, url safe, and never repeats", () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const t = newToken();
    assert.match(t, /^[A-Za-z0-9_-]{43}$/);
    assert.ok(looksLikeToken(t));
    seen.add(t);
  }
  assert.equal(seen.size, 200);
});

test("looksLikeToken refuses anything else", () => {
  for (const bad of [undefined, null, "", "short", "a".repeat(44), "a".repeat(42) + "!", 12345]) {
    assert.equal(looksLikeToken(bad), false);
  }
});

test("hashToken is a stable SHA-256 hex and not the token", () => {
  const t = newToken();
  const h = hashToken(t);
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(h, hashToken(t));
  assert.notEqual(h, t);
  assert.notEqual(h, hashToken(newToken()));
  // Known vector: SHA-256("abc").
  assert.equal(hashToken("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("cookie is host-only: __Host- prefix, Secure, HttpOnly, Lax, Path=/, no Domain", () => {
  assert.ok(COOKIE_NAME.startsWith("__Host-"));
  const o = cookieOptions();
  assert.equal(o.httpOnly, true);
  assert.equal(o.secure, true);
  assert.equal(o.sameSite, "lax");
  assert.equal(o.path, "/");
  assert.equal("domain" in o, false);
  assert.equal(o.maxAge, ABSOLUTE_MS / 1000);
});

test("a fresh session is not expired and expires 30 days out", () => {
  const exp = expiryFrom(T0);
  assert.equal(exp.getTime() - T0.getTime(), 30 * 24 * 60 * 60 * 1000);
  const row = { expiresAt: exp, lastSeenAt: T0 };
  assert.equal(isExpired(row, T0), false);
  assert.equal(isExpired(row, at(60 * 1000)), false);
});

test("idle timeout: 7 days without a request ends the session", () => {
  const row = { expiresAt: expiryFrom(T0), lastSeenAt: T0 };
  assert.equal(isExpired(row, at(IDLE_MS - 1)), false);
  assert.equal(isExpired(row, at(IDLE_MS)), true);
});

test("absolute timeout: 30 days ends it even when the browser kept coming back", () => {
  const row = { expiresAt: expiryFrom(T0), lastSeenAt: at(ABSOLUTE_MS - 1000) };
  assert.equal(isExpired(row, at(ABSOLUTE_MS - 500)), false);
  assert.equal(isExpired(row, at(ABSOLUTE_MS)), true);
});

test("a row with an unreadable date counts as expired", () => {
  assert.equal(isExpired({ expiresAt: "not a date", lastSeenAt: T0 }, T0), true);
  assert.equal(isExpired({ expiresAt: expiryFrom(T0), lastSeenAt: undefined }, T0), true);
});

test("last_seen_at is touched at most once per 5 minutes", () => {
  const row = { expiresAt: expiryFrom(T0), lastSeenAt: T0 };
  assert.equal(shouldTouch(row, at(TOUCH_MS - 1)), false);
  assert.equal(shouldTouch(row, at(TOUCH_MS)), true);
});
