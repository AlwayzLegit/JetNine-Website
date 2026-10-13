import "server-only";
import type { NextRequest } from "next/server";
import { verifyTwilioSignatureAny } from "@/lib/twilio";

/**
 * Read a Twilio webhook (form-encoded POST) and check its signature.
 *
 * Twilio signs the URL it requested: the one in its console for the first
 * webhook, or the `action` / `<Redirect>` URL for the ones after. Behind
 * Vercel that host may show up in x-forwarded-host, in host, or in neither
 * (a deployment alias), so every host we could plausibly have been reached
 * on is tried; each candidate is still bound to the auth token. Same check
 * as src/app/api/twilio/inbound/route.ts.
 */
export async function readTwilioWebhook(
  request: NextRequest,
  tag: string,
): Promise<{ ok: true; params: Record<string, string>; url: URL } | { ok: false }> {
  const rawBody = await request.text();
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(rawBody)) params[k] = v;

  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const url = new URL(request.url);
  const pathAndQuery = url.pathname + url.search;
  const hosts = new Set<string>();
  for (const h of [
    request.headers.get("x-forwarded-host"),
    request.headers.get("host"),
    request.headers.get("x-vercel-deployment-url"),
    siteHost(),
  ]) {
    if (h) hosts.add(h);
  }
  const candidates = [...hosts].map((h) => `${proto}://${h}${pathAndQuery}`);

  const sig = request.headers.get("x-twilio-signature");
  if (!verifyTwilioSignatureAny(candidates, params, sig)) {
    console.warn(`[${tag}] signature mismatch`, {
      tried: [...hosts],
      path: pathAndQuery,
      signaturePresent: Boolean(sig),
    });
    return { ok: false };
  }
  return { ok: true, params, url };
}

function siteHost(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).host || null;
  } catch {
    return null;
  }
}
