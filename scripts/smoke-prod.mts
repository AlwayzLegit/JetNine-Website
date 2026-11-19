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
import { createReader } from "./smoke-fetch.mjs";
import { isPausedReply, pausedVerdict } from "./smoke-paused.mjs";

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

// True while the home page carries x-jetnine-writes: paused (the write pause of the cutover window,
// OPS-205). Set once at the start of main(). While it is true, a check that writes, or reads a
// route the pause blocks, expects the pause's 503 instead of its usual answer (scripts/smoke-paused.mts).
let writesPaused = false;

// Reads, with one retry for transport errors only (scripts/smoke-fetch.mts).
// Every first failure is printed here, so a real cut-off for visitors is not
// hidden by the retry: a retry is a warning to look at (OPS-104).
const retries: string[] = [];
const reader = createReader({
  timeoutMs: FETCH_TIMEOUT_MS,
  retryDelayMs: Number(process.env.SMOKE_RETRY_DELAY_MS ?? 10_000),
  headers: COMMON_HEADERS,
  onRetry: (url, err, served) => {
    const note = served ? ` [${[served.ray && `cf-ray ${served.ray}`, served.cache && `edge-cache ${served.cache}`].filter(Boolean).join(", ")}]` : "";
    const line = `read needed a retry: ${url} - ${err.message}${note} at ${new Date().toISOString()}`;
    retries.push(line);
    // GitHub Actions shows ::warning:: lines as annotations on the run.
    console.log(process.env.GITHUB_ACTIONS === "true" ? `::warning title=smoke retry::${line}` : `[retry] ${line}`);
  },
});
const read = reader.read;

async function check(
  name: string,
  severity: "required" | "advisory",
  fn: () => Promise<{ ok: boolean; detail: string }>,
): Promise<void> {
  const t0 = Date.now();
  let outcome: { ok: boolean; detail: string };
  reader.resetServed();
  try {
    outcome = await fn();
  } catch (err) {
    outcome = { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
  if (!outcome.ok) outcome = { ok: false, detail: `${outcome.detail}${reader.servedNote()}` };
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
    const r = await read(`${TARGET}${p.path}`);
    if (r.status !== 200) return { ok: false, detail: `expected 200, got ${r.status}` };
    if (!p.contains.test(r.text)) return { ok: false, detail: `body missing ${p.contains}` };
    return { ok: true, detail: `200 · ${(r.text.length / 1024).toFixed(0)} kB` };
  });
}

// ─── SEO artifacts ───────────────────────────────────────────────────────

async function checkSitemap(): Promise<void> {
  await check("GET /sitemap.xml", "required", async () => {
    const r = await read(`${TARGET}/sitemap.xml`);
    if (r.status !== 200) return { ok: false, detail: `expected 200, got ${r.status}` };
    if (!r.headers.get("content-type")?.includes("xml")) {
      return { ok: false, detail: `expected xml, got ${r.headers.get("content-type")}` };
    }
    const urlCount = (r.text.match(/<url>/g) ?? []).length;
    if (urlCount < 10) return { ok: false, detail: `only ${urlCount} URLs (expected 10+)` };
    return { ok: true, detail: `${urlCount} URLs` };
  });
}

// Which robots policy the target should serve. src/app/robots.ts gives
// production the crawl rules plus a Sitemap: line, and previews a blanket
// "Disallow: /" with no Sitemap: line (docs/robots.md); staging follows the
// same rule as previews (src/app/robots.ts serves it for every non-production
// deploy). /api/health reports the deployment's environment; anything but
// "preview" or "staging" is held to the production policy, so a production
// deploy can never pass while blocking every crawler.
async function targetEnv(): Promise<string | undefined> {
  try {
    const r = await read(`${TARGET}/api/health`);
    return (JSON.parse(r.text) as { env?: string }).env;
  } catch {
    return undefined;
  }
}

async function checkRobots(): Promise<void> {
  const env = await targetEnv();
  await check("GET /robots.txt", "required", async () => {
    const r = await read(`${TARGET}/robots.txt`);
    if (r.status !== 200) return { ok: false, detail: `expected 200, got ${r.status}` };
    const blocksAll = /^Disallow:\s*\/\s*$/m.test(r.text);
    const hasSitemap = /^Sitemap:/m.test(r.text);
    if (env === "preview" || env === "staging") {
      if (!blocksAll) return { ok: false, detail: `${env} must disallow all crawling` };
      if (hasSitemap) return { ok: false, detail: `${env} must not advertise a sitemap` };
      return { ok: true, detail: `${env} policy · Disallow: /` };
    }
    if (!hasSitemap) return { ok: false, detail: "missing Sitemap: line" };
    if (blocksAll) return { ok: false, detail: "production robots blocks all crawling" };
    if (!r.text.includes("Allow") && !r.text.includes("Disallow")) {
      return { ok: false, detail: "missing Allow/Disallow rules" };
    }
    return { ok: true, detail: `${r.text.split("\n").length} lines` };
  });
}

// The empty-legs board reads one store whichever database sits behind it (OPS-113).
// The count of distinct EL codes on the page is printed so production and staging
// can be compared line by line. Read only.
async function checkEmptyLegsBoard(): Promise<void> {
  await check("GET /empty-legs (board)", "required", async () => {
    const r = await read(`${TARGET}/empty-legs`);
    if (r.status !== 200) return { ok: false, detail: `expected 200, got ${r.status}` };
    if (!/Empty Leg/.test(r.text)) return { ok: false, detail: "body missing the board title" };
    const codes = new Set(r.text.match(/EL-\d{4}-\d{4,}/g) ?? []);
    console.log(`empty legs on board: ${codes.size}`);
    return { ok: true, detail: `200 · ${codes.size} legs listed` };
  });
}

// The blog reads one store whichever database sits behind it (OPS-109). The feed
// count is printed so production and staging can be compared line by line.
async function checkBlog(): Promise<void> {
  await check("GET /blog", "required", async () => {
    const r = await read(`${TARGET}/blog`);
    if (r.status !== 200) return { ok: false, detail: `expected 200, got ${r.status}` };
    if (!/Private Jet Charter Blog/.test(r.text)) {
      return { ok: false, detail: "body missing the blog title" };
    }
    return { ok: true, detail: `200 · ${(r.text.length / 1024).toFixed(0)} kB` };
  });
  await check("GET /blog/feed.xml (first post)", "required", async () => {
    const r = await read(`${TARGET}/blog/feed.xml`);
    if (r.status !== 200) return { ok: false, detail: `expected 200, got ${r.status}` };
    const items = [...r.text.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([^<]+)<\/link>/g)];
    console.log(`blog feed items: ${(r.text.match(/<item>/g) ?? []).length}`);
    if (items.length === 0) return { ok: true, detail: "no posts yet, nothing to open" };
    const link = new URL(items[0][2]);
    const post = await read(`${TARGET}${link.pathname}`);
    if (post.status !== 200) return { ok: false, detail: `first post ${link.pathname}: ${post.status}` };
    return { ok: true, detail: `first post ${link.pathname} 200` };
  });
}

async function checkOgImage(): Promise<void> {
  await check("GET /opengraph-image", "required", async () => {
    const r = await read(`${TARGET}/opengraph-image`);
    if (r.status !== 200) return { ok: false, detail: `expected 200, got ${r.status}` };
    const ct = r.headers.get("content-type") ?? "";
    if (!ct.startsWith("image/")) return { ok: false, detail: `expected image/*, got ${ct}` };
    return { ok: true, detail: `${ct} · ${(r.text.length / 1024).toFixed(0)} kB` };
  });
}

// The empty-leg watchlists read one store whichever database sits behind it
// (OPS-116). A made-up confirm token matches no row, so this reads the table and
// writes nothing: the page must say the link is no longer valid, and must not say
// the lookup failed. Printed so staging and production can be compared. Read only.
async function checkWatchlistConfirmLookup(): Promise<void> {
  await check("GET /empty-legs/confirm/[unknown token]", "required", async () => {
    const r = await read(`${TARGET}/empty-legs/confirm/crew-smoke-not-a-token`);
    if (r.status !== 200) return { ok: false, detail: `expected 200, got ${r.status}` };
    if (/couldn.{1,8}t check/i.test(r.text)) {
      return { ok: false, detail: "the page says the lookup failed" };
    }
    if (!/This link is no longer valid/.test(r.text)) {
      return { ok: false, detail: "body missing the no longer valid line" };
    }
    console.log("watchlist confirm lookup: ok");
    return { ok: true, detail: "200 · no longer valid" };
  });
}

// The API key sign-in reads one store whichever database sits behind it (OPS-138). A made-up
// key of the right format (jn_live_ + 8 base32 characters + 43 token characters) matches no
// row, so this reads the table and writes nothing: /api/v1/me must answer 401 with the
// "invalid key" envelope. A 503 would mean the lookup itself failed (no database behind the
// store). No real key is used or needed. Printed so staging and production can be compared.
async function checkApiKeyLookup(): Promise<void> {
  await check("GET /api/v1/me (made-up key)", "required", async () => {
    const r = await read(`${TARGET}/api/v1/me`, {
      headers: { authorization: `Bearer jn_live_crewsmok_${"A".repeat(43)}` },
    });
    const paused = pausedVerdict(writesPaused, "GET", "/api/v1/me", r);
    if (paused) return paused;
    if (r.status === 503 || /temporarily unavailable/i.test(r.text)) {
      return { ok: false, detail: `the key lookup failed (${r.status})` };
    }
    if (r.status !== 401) return { ok: false, detail: `unexpected ${r.status} (expected 401)` };
    console.log("api key lookup: 401 for a made-up key");
    return { ok: true, detail: "401 · made-up key rejected" };
  });
}

// The account area reads the member store whichever database sits behind it (OPS-149). With no
// session cookie, /account must send the visitor to the sign-in page (requireUser redirects to
// /sign-in?next=...). The redirect is not followed, so this proves the app answered without
// reading a member row and leaks nothing. Printed so staging and production can be compared.
async function checkAccountSignInRedirect(): Promise<void> {
  await check("GET /account (no cookie, redirect)", "required", async () => {
    const r = await read(`${TARGET}/account`, { redirect: "manual" });
    if (r.status < 300 || r.status >= 400) {
      return { ok: false, detail: `unexpected ${r.status} (expected a redirect to /sign-in)` };
    }
    const loc = r.headers.get("location") ?? "";
    if (!/\/sign-in(\?|$)/.test(loc)) return { ok: false, detail: `${r.status} → ${loc.slice(0, 60)} (expected /sign-in)` };
    console.log("account sign-in redirect: ok");
    return { ok: true, detail: `${r.status} → ${loc.slice(0, 60)}` };
  });
}

// ─── Agent context sign-in ───────────────────────────────────────────────

// The assistant's read endpoint signs in with the same key lookup as /me, so this shows the
// lookup answers on the agent route too (401 for a made-up key, never a 5xx). It does not reach
// the agent store itself: staging's health `d1 ok` and the store tests are the evidence for that.
async function checkAgentContextLookup(): Promise<void> {
  await check("GET /api/v1/agent/context (made-up key)", "required", async () => {
    const r = await read(`${TARGET}/api/v1/agent/context`, {
      headers: { authorization: `Bearer jn_live_crewsmok_${"A".repeat(43)}` },
    });
    const paused = pausedVerdict(writesPaused, "GET", "/api/v1/agent/context", r);
    if (paused) return paused;
    if (r.status === 503 || /temporarily unavailable/i.test(r.text)) {
      return { ok: false, detail: `the key lookup failed (${r.status})` };
    }
    if (r.status !== 401) return { ok: false, detail: `unexpected ${r.status} (expected 401)` };
    console.log("agent context lookup: 401 for a made-up key");
    return { ok: true, detail: "401 · made-up key rejected" };
  });
}

// ─── API ships-dark surface ──────────────────────────────────────────────

async function checkStripeWebhook(): Promise<void> {
  await check("POST /api/stripe/webhook (no sig)", "required", async () => {
    const r = await read(`${TARGET}/api/stripe/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ test: true }),
    });
    const paused = pausedVerdict(writesPaused, "POST", "/api/stripe/webhook", r);
    if (paused) return paused;
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
    const r = await read(`${TARGET}/api/email/inbound/wrongsecret`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ Subject: "test", TextBody: "x", MessageID: "smoke" }),
    });
    const paused = pausedVerdict(writesPaused, "POST", "/api/email/inbound/wrongsecret", r);
    if (paused) return paused;
    // 404 either means INBOUND_EMAIL_SECRET unset OR the wrong secret
    // missed — both are correct ships-dark behavior.
    if (r.status === 404) return { ok: true, detail: "404 · endpoint hidden behind secret" };
    return { ok: false, detail: `unexpected ${r.status} (expected 404)` };
  });
}

async function checkTwilioInbound(): Promise<void> {
  await check("POST /api/twilio/inbound (no sig)", "required", async () => {
    const r = await read(`${TARGET}/api/twilio/inbound`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "From=%2B15551234567&Body=test&MessageSid=smoke",
    });
    const paused = pausedVerdict(writesPaused, "POST", "/api/twilio/inbound", r);
    if (paused) return paused;
    if (r.status === 403) return { ok: true, detail: "403 · twilio configured + signature rejected" };
    if (r.status === 503) return { ok: true, detail: "503 · twilio NOT configured (ships dark)" };
    return { ok: false, detail: `unexpected ${r.status}` };
  });
}

async function checkWatchlistCron(): Promise<void> {
  // This endpoint sends SMS and email to customers. The only thing
  // standing between the open internet and that is the bearer check, so
  // a regression here is a security regression and worth catching on the
  // deploy that causes it rather than from a phone bill. Both a missing
  // credential and a wrong one must be refused: a 200 would mean the
  // guard had been removed or CRON_SECRET had been unset in Vercel.
  await check("GET /api/cron/empty-leg-watchlists (no auth)", "required", async () => {
    const r = await read(`${TARGET}/api/cron/empty-leg-watchlists`);
    const paused = pausedVerdict(writesPaused, "GET", "/api/cron/empty-leg-watchlists", r);
    if (paused) return paused;
    if (r.status !== 401) return { ok: false, detail: `unexpected ${r.status} (expected 401)` };
    return { ok: true, detail: "401 · fails closed without a credential" };
  });
  await check("GET /api/cron/empty-leg-watchlists (bad bearer)", "required", async () => {
    const r = await read(`${TARGET}/api/cron/empty-leg-watchlists`, {
      headers: { authorization: "Bearer smoke-not-the-secret" },
    });
    const paused = pausedVerdict(writesPaused, "GET", "/api/cron/empty-leg-watchlists", r);
    if (paused) return paused;
    if (r.status !== 401) return { ok: false, detail: `unexpected ${r.status} (expected 401)` };
    return { ok: true, detail: "401 · wrong credential rejected" };
  });
}

async function checkUnsubscribeEndpoint(): Promise<void> {
  // RFC 8058 one-click. Gmail and Yahoo POST here from their own
  // unsubscribe button, so it has to answer 200 even for a token it does
  // not know: a retry after a timeout must not look like a failure, and
  // a 404 would tell a prober which tokens are real. A regression to
  // anything else breaks unsubscribe for every recipient at once.
  await check("POST /api/email/unsubscribe (unknown token)", "required", async () => {
    const r = await read(`${TARGET}/api/email/unsubscribe/smoke-not-a-real-token`, {
      method: "POST",
    });
    const paused = pausedVerdict(writesPaused, "POST", "/api/email/unsubscribe/smoke-not-a-real-token", r);
    if (paused) return paused;
    if (r.status !== 200) return { ok: false, detail: `unexpected ${r.status} (expected 200)` };
    return { ok: true, detail: "200 · idempotent, leaks nothing" };
  });
}

// ─── Auth gating ─────────────────────────────────────────────────────────

async function checkAuthRedirect(path: string): Promise<void> {
  await check(`GET ${path} (gated)`, "required", async () => {
    const r = await read(`${TARGET}${path}`, { redirect: "manual" });
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
    const r = await read(TARGET, { method: "HEAD" });
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
    const r = await read(TARGET, { method: "HEAD" });
    // Cloudflare has no region to pin: Smart Placement moves the Worker
    // near the database. Only a Vercel deploy (the rollback target) can be
    // checked for its cle1 pin.
    if (r.headers.has("cf-ray") && !r.headers.has("x-vercel-id")) {
      return { ok: true, detail: `cloudflare · ${r.headers.get("cf-ray")}` };
    }
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

  // Anonymous callers get ok / status / env / failing only. With the
  // deployment's CRON_SECRET in the environment the endpoint returns the
  // full snapshot (commit, region, per-check detail) for the log.
  const healthAuth: Record<string, string> = process.env.CRON_SECRET
    ? { authorization: `Bearer ${process.env.CRON_SECRET}` }
    : {};

  await check("GET /api/health", "required", async () => {
    const r = await read(`${TARGET}/api/health`, { headers: healthAuth });
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
      failing?: string[];
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
      const failed = body.checks
        ? Object.entries(body.checks)
            .filter(([, v]) => v && v.ok === false)
            .map(([k, v]) => {
              const err = (v as { error?: string }).error;
              return err ? `${k}(${err})` : k;
            })
        : (body.failing ?? []);
      // Echo the full diagnostic body so CI logs have ground truth
      // without an extra curl. Indent so it stands out from the
      // single-line check rows above.
      console.log("");
      console.log("  /api/health body:");
      for (const line of JSON.stringify(body, null, 2).split("\n")) {
        console.log("    " + line);
      }
      console.log("");
      return {
        ok: false,
        detail: `unhealthy; failing: ${failed.length ? failed.join(", ") : "unknown"}`,
      };
    }
    const detail = body.sha
      ? `${body.status} · ${body.env}/${body.region} · sha ${body.sha}`
      : `${body.status} · ${body.env}`;
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

  // One read of the home page tells whether the site is in its write pause (OPS-211). A failed read
  // leaves the pause off: the page checks below fail on their own and say why.
  try {
    writesPaused = isPausedReply(await read(TARGET, { method: "HEAD" }));
  } catch {
    writesPaused = false;
  }
  if (writesPaused) console.log("writes paused: POST checks expect 503");
  console.log("");

  for (const p of MARKETING_PAGES) {
    await checkPage(p);
    await sleep(50); // gentle on CDN
  }
  await checkHealthEndpoint();
  await checkSitemap();
  await checkRobots();
  await checkBlog();
  await checkOgImage();
  await checkEmptyLegsBoard();
  await checkWatchlistConfirmLookup();
  await checkApiKeyLookup();
  await checkAccountSignInRedirect();
  await checkAgentContextLookup();
  await checkStripeWebhook();
  await checkEmailInbound();
  await checkTwilioInbound();
  await checkWatchlistCron();
  await checkUnsubscribeEndpoint();
  await checkAuthRedirect("/account");
  await checkAuthRedirect("/admin");
  await checkSecurityHeaders();
  await checkRegionPin();

  console.log("");
  console.log(`${retries.length} reads needed a retry`);
  for (const line of retries) console.log(`  ${line}`);

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
