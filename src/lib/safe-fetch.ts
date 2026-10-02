import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Fetch a URL supplied by an API caller without letting it reach our own
 * network: https on port 443 only, every hop's hostname resolved and
 * rejected if any address is private, loopback, link-local (incl. cloud
 * metadata), CGNAT, multicast or unique-local; redirects followed by hand
 * (max 3) and re-checked; 15 s timeout; body streamed with a byte cap.
 */

export type SafeFetchResult =
  | { ok: true; body: Buffer; contentType: string; finalUrl: string }
  | { ok: false; status: number; error: string };

function v4ToInt(ip: string): number {
  return ip.split(".").reduce((n, o) => (n << 8) + Number(o), 0) >>> 0;
}

function inV4(ip: string, cidr: string): boolean {
  const [base, bits] = cidr.split("/");
  const mask = Number(bits) === 0 ? 0 : (~0 << (32 - Number(bits))) >>> 0;
  return (v4ToInt(ip) & mask) === (v4ToInt(base) & mask);
}

const BLOCKED_V4 = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.0.2.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "198.51.100.0/24",
  "203.0.113.0/24",
  "224.0.0.0/4",
  "240.0.0.0/4",
];

/** Expand an IPv6 address (any notation, incl. a trailing dotted IPv4) to 8 hextets. */
function expandV6(ip: string): number[] | null {
  let a = ip.toLowerCase().split("%")[0];
  const dotted = /(\d+\.\d+\.\d+\.\d+)$/.exec(a);
  if (dotted) {
    if (isIP(dotted[1]) !== 4) return null;
    const n = v4ToInt(dotted[1]);
    a = a.slice(0, -dotted[1].length) + `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const halves = a.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0) return null;
  const parts = [...head, ...Array(fill).fill("0"), ...tail];
  if (parts.length !== 8) return null;
  const out = parts.map((h) => (/^[0-9a-f]{1,4}$/.test(h) ? parseInt(h, 16) : NaN));
  return out.some(Number.isNaN) ? null : out;
}

const v4From = (hi: number, lo: number) => `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;

/** True when the address must never be fetched. Exported for scripts/check-api.mts. */
export function isBlockedAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return BLOCKED_V4.some((c) => inV4(ip, c));
  if (v !== 6) return true;
  const h = expandV6(ip);
  if (!h) return true;
  const zeros = (n: number) => h.slice(0, n).every((x) => x === 0);
  // ::/96 (incl. :: and ::1, IPv4-compatible), ::ffff:0:0/96 (mapped),
  // ::ffff:0:0:0/96 (translated): judge by the embedded IPv4.
  if (zeros(6) || (zeros(5) && h[5] === 0xffff) || (zeros(4) && h[4] === 0xffff && h[5] === 0)) {
    return zeros(8) || (zeros(7) && h[7] === 1) || isBlockedAddress(v4From(h[6], h[7]));
  }
  if (h[0] === 0x64 && h[1] === 0xff9b) return true; // NAT64 64:ff9b::/96 and 64:ff9b:1::/48
  if (h[0] === 0x2002) return isBlockedAddress(v4From(h[1], h[2])); // 6to4 embeds an IPv4
  if (h[0] === 0x2001 && (h[1] === 0 || h[1] === 0xdb8)) return true; // Teredo, documentation
  if ((h[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((h[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link local
  if ((h[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  return false;
}

async function hostIsSafe(hostname: string): Promise<boolean> {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return !isBlockedAddress(host);
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) return false;
  try {
    const addrs = await lookup(host, { all: true, verbatim: true });
    return addrs.length > 0 && addrs.every((a) => !isBlockedAddress(a.address));
  } catch {
    return false;
  }
}

export async function safeFetch(
  rawUrl: string,
  opts: { maxBytes: number; accept?: string; requireContentTypePrefix?: string; timeoutMs?: number },
): Promise<SafeFetchResult> {
  const deadline = AbortSignal.timeout(opts.timeoutMs ?? 15_000);
  let url = rawUrl;
  for (let hop = 0; hop <= 3; hop++) {
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      return { ok: false, status: 422, error: "Not a valid URL." };
    }
    if (u.protocol !== "https:" || (u.port && u.port !== "443") || u.username || u.password) {
      return { ok: false, status: 422, error: "Only plain https:// URLs on the standard port are allowed." };
    }
    if (!(await hostIsSafe(u.hostname))) {
      return { ok: false, status: 422, error: "That host is not allowed." };
    }
    let res: Response;
    try {
      res = await fetch(u, {
        redirect: "manual",
        headers: { Accept: opts.accept ?? "*/*" },
        signal: deadline,
      });
    } catch (e) {
      return { ok: false, status: 502, error: `Could not fetch the URL (${e instanceof Error ? e.name : "error"}).` };
    }
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      if (!next) return { ok: false, status: 502, error: "Redirect without a location." };
      url = new URL(next, u).toString();
      continue;
    }
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok) return { ok: false, status: 502, error: `The URL answered ${res.status}.` };
    if (opts.requireContentTypePrefix && !type.startsWith(opts.requireContentTypePrefix)) {
      return { ok: false, status: 502, error: `The URL did not return ${opts.requireContentTypePrefix}* (${type || "no content-type"}).` };
    }
    const declared = Number(res.headers.get("content-length") ?? "0");
    if (declared > opts.maxBytes) return { ok: false, status: 413, error: "The file is too large." };
    if (!res.body) return { ok: false, status: 502, error: "Empty response." };
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > opts.maxBytes) {
        await reader.cancel();
        return { ok: false, status: 413, error: "The file is too large." };
      }
      chunks.push(value);
    }
    return { ok: true, body: Buffer.concat(chunks), contentType: type, finalUrl: u.toString() };
  }
  return { ok: false, status: 502, error: "Too many redirects." };
}
