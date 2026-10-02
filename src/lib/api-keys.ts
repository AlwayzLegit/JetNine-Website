import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * API key primitives (no database). Shared by the auth layer, the
 * Settings › API keys page and scripts/check-api.mts.
 *
 * Token format: jn_live_<prefix>_<secret>
 *   prefix  8 chars of lowercase base32 — public, used to find the row
 *   secret  43 chars of base64url (32 random bytes) — never stored
 * Only sha256(token) is stored; the token is shown once at creation.
 */

export const SCOPES = ["read", "content", "desk", "clients", "money", "settings", "admin", "agent"] as const;
export type Scope = (typeof SCOPES)[number];

export const SCOPE_WORDS: Record<Scope, { label: string; can: string }> = {
  read: { label: "Read", can: "read requests, trips, clients, messages, reports and history" },
  content: { label: "Content", can: "write and publish blog posts" },
  desk: { label: "Desk", can: "work requests, trips, messages and empty legs" },
  clients: { label: "Clients", can: "invite clients and link them to requests" },
  money: { label: "Money", can: "confirm bookings, invoices and reserve entries" },
  settings: { label: "Settings", can: "change desk settings and reference data" },
  admin: { label: "Full access", can: "everything an owner can do over the API" },
  agent: { label: "Assistant", can: "read its instructions, log runs and memory, propose changes" },
};

/** Scopes that imply every other scope. */
const ALL: ReadonlySet<Scope> = new Set(SCOPES);

/** What a desk role may ever do over the API, before the key's own cap. */
export function scopesForRole(role: string): ReadonlySet<Scope> {
  if (role === "admin" || role === "superadmin") return ALL;
  if (role === "dispatcher") return new Set<Scope>(["read", "content", "desk", "clients", "money", "agent"]);
  return new Set();
}

/** Expand `admin` to everything, then cap by what the creator's role allows. */
export function effectiveScopes(keyScopes: readonly string[], creatorRole: string): Set<Scope> {
  const asked = new Set<Scope>(
    keyScopes.includes("admin") ? SCOPES : keyScopes.filter((s): s is Scope => (SCOPES as readonly string[]).includes(s)),
  );
  const allowed = scopesForRole(creatorRole);
  return new Set([...asked].filter((s) => allowed.has(s)));
}

export function isScope(s: string): s is Scope {
  return (SCOPES as readonly string[]).includes(s);
}

export type KeyTemplate = {
  id: "assistant" | "full" | "read";
  name: string;
  scopes: Scope[];
  supervised: boolean;
  expiresInDays: number | null;
  note: string;
};

export const KEY_TEMPLATES: KeyTemplate[] = [
  {
    id: "assistant",
    name: "Daily assistant",
    scopes: ["read", "content", "desk", "agent"],
    supervised: true,
    expiresInDays: 90,
    note: "For the scheduled task. Publishes posts and works the desk; asks before contacting clients.",
  },
  {
    id: "full",
    name: "Full access for me",
    scopes: ["admin"],
    supervised: false,
    expiresInDays: 90,
    note: "Everything an owner can do over the API. Keep it private.",
  },
  {
    id: "read",
    name: "Read only",
    scopes: ["read"],
    supervised: false,
    expiresInDays: null,
    note: "Reports and dashboards. Cannot change anything.",
  },
];

const PREFIX_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";
export const TOKEN_RE = /^jn_live_([a-z2-7]{8})_([A-Za-z0-9_-]{43})$/;

export function mintToken(): { token: string; prefix: string; hash: string; last4: string } {
  const bytes = randomBytes(8);
  let prefix = "";
  for (const b of bytes) prefix += PREFIX_ALPHABET[b % 32];
  const secret = randomBytes(32).toString("base64url");
  const token = `jn_live_${prefix}_${secret}`;
  return { token, prefix, hash: hashToken(token), last4: token.slice(-4) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Format check only — never touches the database. */
export function parseToken(raw: string | null | undefined): { prefix: string; token: string } | null {
  if (!raw) return null;
  const m = TOKEN_RE.exec(raw.trim());
  return m ? { prefix: m[1], token: m[0] } : null;
}

/** Constant-time comparison of two hex digests. */
export function hashesEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && ab.length > 0 && timingSafeEqual(ab, bb);
}

/** "jn_live_ab12cd34…wxyz" for display. */
export function maskedToken(prefix: string, last4: string): string {
  return `jn_live_${prefix}…${last4}`;
}
