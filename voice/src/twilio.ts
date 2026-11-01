// The two pieces of the twilio SDK this service used, without the SDK (it
// does not run on Workers): webhook signature validation with WebCrypto,
// and REST calls with fetch + Basic auth.

const enc = new TextEncoder();

/**
 * X-Twilio-Signature: base64(HMAC-SHA1(authToken, url + sorted form params)).
 * `url` is the full URL Twilio requested, query string included; each POST
 * param is appended as name+value, sorted by name (case-sensitive).
 * https://www.twilio.com/docs/usage/security#validating-requests
 */
export async function twilioSignature(authToken: string, url: string, params: Record<string, string>): Promise<string> {
  const data =
    url +
    Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join("");
  const key = await crypto.subtle.importKey("raw", enc.encode(authToken), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
  let bin = "";
  for (const b of mac) bin += String.fromCharCode(b);
  return btoa(bin);
}

function safeEqual(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/**
 * Constant-time compare of the expected signature with the header.
 * `trailingSlash`: also accept the URL with a `/` after the path, which
 * Twilio's docs suggest for WebSocket handshakes.
 */
export async function validateTwilioRequest(
  authToken: string,
  signature: string | null,
  url: string,
  params: Record<string, string>,
  opts: { trailingSlash?: boolean } = {},
): Promise<boolean> {
  if (!authToken || !signature) return false;
  const candidates = [url];
  if (opts.trailingSlash) {
    const u = new URL(url);
    if (!u.pathname.endsWith("/")) {
      u.pathname += "/";
      candidates.push(u.toString());
    }
  }
  for (const candidate of candidates) {
    if (safeEqual(await twilioSignature(authToken, candidate, params), signature)) return true;
  }
  return false;
}

/** POST a form to the 2010-04-01 REST API, e.g. path `/Calls/CA…/Recordings.json`. Throws on non-2xx. */
export async function twilioPost(
  creds: { accountSid: string; authToken: string },
  path: string,
  form: [string, string][],
): Promise<unknown> {
  if (!creds.accountSid || !creds.authToken) {
    throw new Error("Twilio is not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)");
  }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}${path}`, {
    method: "POST",
    headers: {
      authorization: `Basic ${btoa(`${creds.accountSid}:${creds.authToken}`)}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(form),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (body as { message?: string; code?: number } | null)?.message ?? res.statusText;
    throw new Error(`Twilio ${res.status}: ${msg}`);
  }
  return body;
}
