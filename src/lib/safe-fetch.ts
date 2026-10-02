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

/** True when the address must never be fetched. Exported for scripts/check-api.mts. */
export function isBlockedAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return BLOCKED_V4.some((c) => inV4(ip, c));
  if (v === 6) {
    const a = ip.toLowerCase();
    if (a === "::" || a === "::1") return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(a);
    if (mapped) return isBlockedAddress(mapped[1]);
    const first = parseInt(a.split(":")[0] || "0", 16);
    if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
    if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link local
    if ((first & 0xff00) === 0xff00) return true; // ff00::/8 multicast
    if (a.startsWith("64:ff9b:")) return true; // NAT64 can reach v4 private space
    return false;
  }
  return true;
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
