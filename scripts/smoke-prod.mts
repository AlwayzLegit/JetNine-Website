/* eslint-disable no-console */
/**
 * Production smoke runner.
 *
 * One command that exercises the live deployment end-to-end. Catches
 * the things unit + Playwright tests don't: real CDN, real CSP, real
 * env vars, real DB connection, real region routing.
 *
 * Usage:
 *   pnpm smoke                                      # against prod default
 *   BASE_URL=https://my-preview.vercel.app pnpm smoke
 *
 * Exit code: 0 if all required checks pass, 1 otherwise. CI-friendly.
 *
 * No mutations against the target — every check is GET / HEAD or a
 * POST that we know returns 4xx without side effects (webhook stubs).
 * A future tier-4 flag will exercise the full quote→trip→invoice cycle
 * against Stripe test mode, but that requires either a preview deploy
 * with test keys or a `?test=1` mode in the app — separate batch.
 */
import { setTimeout as sleep } from "node:timers/promises";

const TARGET = (process.env.BASE_URL ?? "https://jet-nine-website.vercel.app").replace(/\/$/, "");
const FETCH_TIMEOUT_MS = 15_000;
// MCP_FETCH_HOST forwards requests through the Vercel MCP web_fetch_vercel_url
// when the runner can't reach *.vercel.app directly (e.g. agent sandbox).
// Not used in normal CI — leave unset.
const USE_MCP = process.env.SMOKE_VIA_MCP === "1";
// Vercel preview deployments may be gated by Vercel Authentication.
// Setting VERCEL_AUTOMATION_BYPASS_SECRET to a project-level bypass
// token lets the runner pass `x-vercel-protection-bypass` so smoke
// can hit protected previews without SSO.
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const COMMON_HEADERS: Record<string, string> = BYPASS
  ? { "x-vercel-protection-bypass": BYPASS, "x-vercel-set-bypass-cookie": "true" }
  : {};

type CheckResult = {
  name: string;
  ok: boolean;
  detail: string;
  ms: number;
  severity: "required" | "advisory";
};

const results: CheckResult[] = [];

async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
): Promise<{ status: number; headers: Headers; text: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const merged: RequestInit = {
      ...init,
      signal: ctrl.signal,
      headers: { ...COMMON_HEADERS, ...(init?.headers as Record<string, string> | undefined) },
    };
    const res = await fetch(url, merged);
    const text = await res.text().catch(() => "");
    return { status: res.status, headers: res.headers, text };
  } finally {
    clearTimeout(t);
  }
}

async function check(
  name: string,
  severity: "required" | "advisory",
  fn: () => Promise<{ ok: boolean; detail: string }>,
): Promise<void> {
  const t0 = Date.now();
  let outcome: { ok: boolean; detail: string };
  try {
    outcome = await fn();
  } catch (err) {
    outcome = { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
  const ms = Date.now() - t0;
  results.push({ name, severity, ok: outcome.ok, detail: outcome.detail, ms });
  const tag = outcome.ok ? "ok  " : severity === "required" ? "FAIL" : "warn";
  console.log(`[${tag}] ${name.padEnd(50)} ${String(ms).padStart(5)}ms  ${outcome.detail}`);
}

// ─── Public pages ────────────────────────────────────────────────────────

const MARKETING_PAGES = [
  { path: "/", contains: /JetNine/i },
  { path: "/about", contains: /JetNine/i },
  { path: "/memberships", contains: /Card/i },
  { path: "/aircraft", contains: /aircraft/i },
  { path: "/aircraft/turboprop", contains: /turboprop/i },
  { path: "/aircraft/light", contains: /light/i },
  { path: "/aircraft/midsize", contains: /midsize/i },
  { path: "/aircraft/supermid", contains: /super.?mid/i },
  { path: "/aircraft/heavy", contains: /heavy/i },
  { path: "/aircraft/ultra", contains: /ultra/i },
  { path: "/how-it-works", contains: /works/i },
  { path: "/safety", contains: /safety/i },
  { path: "/contact", contains: /dispatch/i },
  { path: "/faq", contains: /FAQ|frequently/i },
  { path: "/legal", contains: /Part 295/i },
  { path: "/empty-legs", contains: /Repositioning legs/i },
  { path: "/quote/mission", contains: /Mission|quote/i },
] as const;

async function checkPage(p: (typeof MARKETING_PAGES)[number]): Promise<void> {
  await check(`GET ${p.path}`, "required", async () => {
    const r = await fetchWithTimeout(`${TARGET}${p.path}`);
    if (r.status !== 200) return { ok: false, detail: `expected 200, got ${r.status}` };
    if (!p.contains.test(r.text)) return { ok: false, detail: `body missing ${p.contains}` };
    return { ok: true, detail: `200 · ${(r.text.length / 1024).toFixed(0)} kB` };
  });
}

// ─── SEO artifacts ───────────────────────────────────────────────────────

async function checkSitemap(): Promise<void> {
  await check("GET /sitemap.xml", "required", async () => {
    const r = await fetchWithTimeout(`${TARGET}/sitemap.xml`);
    if (r.status !== 200) return { ok: false, detail: `expected 200, got ${r.status}` };
    if (!r.headers.get("content-type")?.includes("xml")) {
      return { ok: false, detail: `expected xml, got ${r.headers.get("content-type")}` };
    }
    const urlCount = (r.text.match(/<url>/g) ?? []).length;
    if (urlCount < 10) return { ok: false, detail: `only ${urlCount} URLs (expected 10+)` };
    return { ok: true, detail: `${urlCount} URLs` };
  });
}

async function checkRobots(): Promise<void> {
  await check("GET /robots.txt", "required", async () => {
    const r = await fetchWithTimeout(`${TARGET}/robots.txt`);
    if (r.status !== 200) return { ok: false, detail: `expected 200, got ${r.status}` };
    if (!r.text.includes("Sitemap:")) return { ok: false, detail: "missing Sitemap: line" };
    if (!r.text.includes("Allow") && !r.text.includes("Disallow")) {
      return { ok: false, detail: "missing Allow/Disallow rules" };
    }
    return { ok: true, detail: `${r.text.split("\n").length} lines` };
  });
}

async function checkOgImage(): Promise<void> {
  await check("GET /opengraph-image", "required", async () => {
    const r = await fetchWithTimeout(`${TARGET}/opengraph-image`);
    if (r.status !== 200) return { ok: false, detail: `expected 200, got ${r.status}` };
    const ct = r.headers.get("content-type") ?? "";
    if (!ct.startsWith("image/")) return { ok: false, detail: `expected image/*, got ${ct}` };
    return { ok: true, detail: `${ct} · ${(r.text.length / 1024).toFixed(0)} kB` };
  });
}

// ─── API ships-dark surface ──────────────────────────────────────────────

async function checkStripeWebhook(): Promise<void> {
  await check("POST /api/stripe/webhook (no sig)", "required", async () => {
    const r = await fetchWithTimeout(`${TARGET}/api/stripe/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ test: true }),
    });
    // 400 (sig verify failed) means Stripe IS configured.
    // 503 (not configured) means env vars missing.
    // Either is a healthy ships-dark response; 5xx with no body would be a crash.
    if (r.status === 400) return { ok: true, detail: "400 · stripe configured + signature rejected" };
    if (r.status === 503) return { ok: true, detail: "503 · stripe NOT configured (ships dark)" };
    return { ok: false, detail: `unexpected ${r.status}` };
  });
}

async function checkEmailInbound(): Promise<void> {
  await check("POST /api/email/inbound/wrongsecret", "required", async () => {
    const r = await fetchWithTimeout(`${TARGET}/api/email/inbound/wrongsecret`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ Subject: "test", TextBody: "x", MessageID: "smoke" }),
    });
    // 404 either means INBOUND_EMAIL_SECRET unset OR the wrong secret
    // missed — both are correct ships-dark behavior.
    if (r.status === 404) return { ok: true, detail: "404 · endpoint hidden behind secret" };
    return { ok: false, detail: `unexpected ${r.status} (expected 404)` };
  });
}

async function checkTwilioInbound(): Promise<void> {
  await check("POST /api/twilio/inbound (no sig)", "required", async () => {
    const r = await fetchWithTimeout(`${TARGET}/api/twilio/inbound`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "From=%2B15551234567&Body=test&MessageSid=smoke",
    });
    if (r.status === 403) return { ok: true, detail: "403 · twilio configured + signature rejected" };
    if (r.status === 503) return { ok: true, detail: "503 · twilio NOT configured (ships dark)" };
    return { ok: false, detail: `unexpected ${r.status}` };
  });
}

// ─── Auth gating ─────────────────────────────────────────────────────────

async function checkAuthRedirect(path: string): Promise<void> {
  await check(`GET ${path} (gated)`, "required", async () => {
    const r = await fetchWithTimeout(`${TARGET}${path}`, { redirect: "manual" });
    // Middleware should 307 to /sign-in?next=... OR render the sign-in
    // page directly. Either is acceptable — what matters is we don't
    // leak the auth-gated content.
    if (r.status >= 300 && r.status < 400) {
      const loc = r.headers.get("location") ?? "";
      if (loc.includes("/sign-in")) return { ok: true, detail: `${r.status} → ${loc.slice(0, 60)}` };
      return { ok: false, detail: `${r.status} → ${loc} (expected /sign-in)` };
    }
    if (r.status === 200 && /sign.?in/i.test(r.text)) {
      return { ok: true, detail: "200 (rendered sign-in inline)" };
    }
    return { ok: false, detail: `${r.status} (expected redirect or sign-in)` };
  });
}

// ─── Security headers ────────────────────────────────────────────────────

async function checkSecurityHeaders(): Promise<void> {
  await check("HEAD / (security headers)", "required", async () => {
    const r = await fetchWithTimeout(TARGET, { method: "HEAD" });
    if (r.status !== 200) return { ok: false, detail: `expected 200, got ${r.status}` };
    const missing: string[] = [];
    const required: Array<[string, RegExp]> = [
      ["content-security-policy", /default-src/],
      ["x-frame-options", /DENY/i],
      ["x-content-type-options", /nosniff/i],
      ["referrer-policy", /.+/],
      ["permissions-policy", /.+/],
      ["strict-transport-security", /max-age/],
    ];
    for (const [h, re] of required) {
      const v = r.headers.get(h);
      if (!v || !re.test(v)) missing.push(h);
    }
    if (missing.length > 0) {
      return { ok: false, detail: `missing/bad: ${missing.join(", ")}` };
    }
    return { ok: true, detail: `${required.length} headers present` };
  });
}

// ─── Region pin (advisory — depends on edge routing) ─────────────────────

async function checkRegionPin(): Promise<void> {
  await check("region pin (advisory)", "advisory", async () => {
    const r = await fetchWithTimeout(TARGET, { method: "HEAD" });
    const id = r.headers.get("x-vercel-id") ?? "";
    if (id.includes("cle1")) return { ok: true, detail: id };
    return { ok: false, detail: `${id} (expected cle1 in chain)` };
  });
}

// ─── Health endpoint ─────────────────────────────────────────────────────

async function checkHealthEndpoint(): Promise<void> {
  // For localhost runs against `pnpm start` with a dummy DATABASE_URL,
  // 503 (DB unreachable) is the expected outcome — local validation
  // shouldn't fail just because the smoke target has no real DB.
  // Against any other host the smoke runner expects a healthy 200.
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(TARGET);

  await check("GET /api/health", "required", async () => {
    const r = await fetchWithTimeout(`${TARGET}/api/health`);
    if (r.status !== 200 && r.status !== 503) {
      return { ok: false, detail: `expected 200 or 503, got ${r.status}` };
    }
    if (r.status === 503 && !isLocal) {
      return { ok: false, detail: "503 — DB unreachable (see body for failing checks)" };
    }
    let body: {
      ok?: boolean;
      status?: string;
      env?: string;
      region?: string;
      sha?: string;
      checks?: Record<string, { ok?: boolean }>;
    };
    try {
      body = JSON.parse(r.text);
    } catch {
      return { ok: false, detail: "non-JSON response" };
    }
    if (typeof body.ok !== "boolean") {
      return { ok: false, detail: "missing .ok field" };
    }
    if (!body.ok && !isLocal) {
      const failed = Object.entries(body.checks ?? {})
        .filter(([, v]) => v && v.ok === false)
        .map(([k]) => k)
        .join(",");
      return { ok: false, detail: `unhealthy; failing checks: ${failed || "unknown"}` };
    }
    const detail = `${body.status} · ${body.env}/${body.region} · sha ${body.sha}`;
    return { ok: true, detail };
  });
}

// ─── Run ─────────────────────────────────────────────────────────────────

async function main() {
  if (USE_MCP) {
    console.error("SMOKE_VIA_MCP is set but the runner uses raw fetch; ignored.");
  }
  console.log(`=== JetNine production smoke ===`);
  console.log(`target: ${TARGET}`);
  console.log("");

  for (const p of MARKETING_PAGES) {
    await checkPage(p);
    await sleep(50); // gentle on CDN
  }
  await checkHealthEndpoint();
  await checkSitemap();
  await checkRobots();
  await checkOgImage();
  await checkStripeWebhook();
  await checkEmailInbound();
  await checkTwilioInbound();
  await checkAuthRedirect("/account");
  await checkAuthRedirect("/admin");
  await checkSecurityHeaders();
  await checkRegionPin();

  const required = results.filter((r) => r.severity === "required");
  const failedRequired = required.filter((r) => !r.ok);
  const advisory = results.filter((r) => r.severity === "advisory");
  const failedAdvisory = advisory.filter((r) => !r.ok);

  console.log("");
  console.log("─".repeat(80));
  console.log(
    `${required.length - failedRequired.length}/${required.length} required passed` +
      (advisory.length > 0
        ? `, ${advisory.length - failedAdvisory.length}/${advisory.length} advisory`
        : ""),
  );

  if (failedRequired.length > 0) {
    console.log("");
    console.log("FAILED:");
    for (const r of failedRequired) {
      console.log(`  ${r.name}  —  ${r.detail}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("smoke runner crashed:", err);
  process.exit(2);
});
