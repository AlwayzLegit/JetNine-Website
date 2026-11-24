// A short signed cookie that says "this browser passed Turnstile" so the chat
// asks for the check once per chat session and not once per message (OPS-242).
// HMAC-SHA256 over a fixed label and the expiry, keyed by CRON_SECRET (already
// a secret of every deployment); the label keeps the signature from being
// valid for any other use of that key. Web Crypto only, so it runs on Workers.

export const CHAT_COOKIE = "jn_chat";
export const SESSION_SECONDS = 2 * 60 * 60;
const LABEL = "jn-chat-v1|";

async function sign(secret: string, exp: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${LABEL}${exp}`));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** The cookie value for a session that starts at `nowMs`. */
export async function issueSession(secret: string, nowMs = Date.now()): Promise<string> {
  const exp = Math.floor(nowMs / 1000) + SESSION_SECONDS;
  return `${exp}.${await sign(secret, exp)}`;
}

/** True for a cookie value this secret signed that has not expired. */
export async function verifySession(secret: string, value: string | undefined | null, nowMs = Date.now()): Promise<boolean> {
  if (!value) return false;
  const [expText, mac, extra] = value.split(".");
  if (extra !== undefined || !expText || !mac || !/^\d{1,12}$/.test(expText)) return false;
  const exp = Number(expText);
  if (exp * 1000 < nowMs) return false;
  return sameString(mac, await sign(secret, exp));
}

export function cookieFromHeader(header: string | null, name = CHAT_COOKIE): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return undefined;
}
