/* eslint-disable no-console */
/**
 * API invariants that need no database — run with `pnpm check:api` (CI).
 *
 *   - key tokens: mint → parse → hash round trip; malformed tokens refused
 *   - scopes: `admin` expands, the creator's role caps, templates are sane
 *   - SSRF guard: the address classifier blocks private/reserved ranges
 *   - registry: unique ids and paths, every route has a route.ts file that
 *     exports the right method from the right ROUTE entry
 *   - OpenAPI: generates, one operation per route, scope + approval tagged
 *   - blog: the documented zod shapes agree with validatePostInput
 *
 * Importing the registry pulls in the db module, which connects lazily, so
 * a placeholder DATABASE_URL is enough.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

process.env.DATABASE_URL ||= "postgresql://ci:ci@localhost:5432/ci";
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "ci-placeholder";

const keys = await import("../src/lib/api-keys.ts");
const { isBlockedAddress } = await import("../src/lib/safe-fetch.ts");
const { ROUTE, ROUTES } = await import("../src/app/api/v1/_lib/routes.ts");
const { buildOpenApi } = await import("../src/app/api/v1/_lib/openapi.ts");
const { PostCreate, PostUpdate } = await import("../src/domain/blog/schemas.ts");
const { validatePostInput } = await import("../src/lib/blog.ts");

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) return;
  failures++;
  console.error(`✗ ${name}`, detail ?? "");
}

// ─── Tokens ──────────────────────────────────────────────────────────────
{
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const t = keys.mintToken();
    check("token matches format", keys.TOKEN_RE.test(t.token), t.token);
    const p = keys.parseToken(t.token);
    check("token parses", p?.prefix === t.prefix);
    check("hash is sha256 hex", /^[0-9a-f]{64}$/.test(t.hash));
    check("hash round trip", keys.hashesEqual(keys.hashToken(t.token), t.hash));
    check("last4 is token tail", t.token.endsWith(t.last4) && t.last4.length === 4);
    check("prefixes are unique", !seen.has(t.prefix), t.prefix);
    seen.add(t.prefix);
  }
  const t = keys.mintToken().token;
  for (const bad of ["", "Bearer " + t, t + "x", t.slice(0, -1), t.replace("jn_live_", "jn_test_"), t.toUpperCase()]) {
    check(`malformed token refused: ${bad.slice(0, 16)}…`, keys.parseToken(bad) === null);
  }
  check("different hashes compare unequal", !keys.hashesEqual(keys.hashToken("a"), keys.hashToken("b")));
  check("empty hashes compare unequal", !keys.hashesEqual("", ""));
}

// ─── Scopes ──────────────────────────────────────────────────────────────
{
  const eff = (s: string[], role: string) => [...keys.effectiveScopes(s, role)].sort().join(",");
  check("admin expands for owners", eff(["admin"], "admin") === [...keys.SCOPES].sort().join(","));
  check("dispatcher cannot reach settings/admin", !/settings|admin/.test(eff(["admin"], "dispatcher")));
  check("dispatcher keeps desk", eff(["desk", "read"], "dispatcher") === "desk,read");
  check("customer gets nothing", eff(["read"], "customer") === "");
  check("unknown scopes dropped", eff(["read", "root"], "admin") === "read");
  for (const t of keys.KEY_TEMPLATES) {
    check(`template ${t.id}: scopes valid`, t.scopes.every((s) => keys.isScope(s)));
    check(`template ${t.id}: agent keys ask first`, !t.scopes.includes("agent") || t.supervised);
  }
  check("every scope has words", keys.SCOPES.every((s) => keys.SCOPE_WORDS[s]?.label));
}

// ─── SSRF classifier ─────────────────────────────────────────────────────
{
  const blocked = [
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254",
    "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255", "::1", "::", "fd00::1", "fe80::1",
    "::ffff:127.0.0.1", "::ffff:10.0.0.1", "64:ff9b::a00:1", "ff02::1", "not-an-ip",
    // Hex forms Node's URL parser produces for bracketed IPv6 hosts.
    "::ffff:7f00:1", "::ffff:a9fe:a9fe", "::7f00:1", "0:0:0:0:0:ffff:7f00:1", "::ffff:0:7f00:1",
    "2002:7f00:1::", "2002:a9fe:a9fe::1", "2001:0:4136:e378::1", "2001:db8::1", "64:ff9b:1::1",
    "FE80::1", "fe80::1%eth0", "fec0::1",
  ];
  const allowed = [
    "8.8.8.8", "1.1.1.1", "172.32.0.1", "104.16.0.1", "2606:4700::1111", "::ffff:8.8.8.8",
    "::ffff:808:808", "2002:808:808::1", "2a00:1450:4001:80b::200e",
  ];
  for (const ip of blocked) check(`blocks ${ip}`, isBlockedAddress(ip));
  for (const ip of allowed) check(`allows ${ip}`, !isBlockedAddress(ip));
  // What the fetcher actually sees: URL-normalised hosts.
  for (const u of ["https://[::ffff:127.0.0.1]/", "https://2130706433/", "https://0x7f.1/", "https://[::127.0.0.1]/", "https://[0:0:0:0:0:ffff:a9fe:a9fe]/"]) {
    const host = new URL(u).hostname.replace(/^\[|\]$/g, "");
    check(`blocks URL host ${u} (${host})`, isBlockedAddress(host));
  }
}

// ─── Registry ────────────────────────────────────────────────────────────
{
  const ids = new Set<string>();
  const ops = new Set<string>();
  for (const [name, r] of Object.entries(ROUTE)) {
    check(`unique operationId ${r.operationId}`, !ids.has(r.operationId));
    ids.add(r.operationId);
    const op = `${r.method} ${r.path}`;
    check(`unique operation ${op}`, !ops.has(op));
    ops.add(op);
    check(`${name}: summary`, r.summary.trim().length > 0);
    check(`${name}: path starts with /`, r.path.startsWith("/"));
    check(`${name}: writes need a real scope`, r.method === "GET" || r.scope !== "any");
    check(`${name}: GET has no body`, r.method !== "GET" || !r.body);

    const dir = r.path.replace(/\{(\w+)\}/g, "[$1]");
    const file = join("src/app/api/v1", dir, "route.ts");
    if (!existsSync(file)) {
      check(`${name}: route file ${file} exists`, false);
      continue;
    }
    const src = readFileSync(file, "utf8");
    check(
      `${file} exports ${r.method} = apiHandler(ROUTE.${name})`,
      new RegExp(`export const ${r.method} = apiHandler\\(ROUTE\\.${name}\\);`).test(src),
    );
  }
  check("ROUTES lists every ROUTE", ROUTES.length === Object.keys(ROUTE).length);

  // And from the other side: every route file under /api/v1 exports only
  // registered handlers, so nothing there can skip apiHandler's auth.
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(join(dir, e.name)) : e.name === "route.ts" ? [join(dir, e.name)] : [],
    );
  for (const file of walk("src/app/api/v1")) {
    const src = readFileSync(file, "utf8");
    const path = "/" + file.replace(/^src\/app\/api\/v1\//, "").replace(/\/route\.ts$/, "").replace(/\[(\w+)\]/g, "{$1}");
    check(`${file}: no function handlers`, !/export\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/.test(src));
    const exported = [...src.matchAll(/export const (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*=\s*([^;]+);/g)];
    const anyExport = [...src.matchAll(/export const (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)];
    check(`${file}: every method export is a one-line handler`, exported.length === anyExport.length && exported.length > 0);
    for (const [, method, rhs] of exported) {
      const m = /^apiHandler\(ROUTE\.(\w+)\)$/.exec(rhs.trim());
      const def = m ? (ROUTE as Record<string, { method: string; path: string }>)[m[1]] : undefined;
      check(`${file}: ${method} uses a registered route`, Boolean(def), rhs);
      if (def) check(`${file}: ${method} matches ROUTE.${m![1]} (${def.method} ${def.path})`, def.method === method && def.path === path);
    }
  }
}

// ─── No Date objects inside raw sql templates ────────────────────────────
{
  // drizzle's postgres-js driver passes timestamps through untouched, so a
  // Date interpolated into sql`…` (no column to serialize it) throws at
  // query time. Use date.toISOString() with ::timestamptz instead.
  const walkSrc = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walkSrc(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : [],
    );
  for (const file of walkSrc("src")) {
    const src = readFileSync(file, "utf8");
    const dates = new Set(
      [...src.matchAll(/\b(?:const|let)\s+(\w+)\s*(?::\s*Date\s*)?=\s*new Date\(([^\n]*)/g)]
        .filter((m) => !/\)\s*\.\w+\(/.test(m[2])) // new Date(…).toISOString() etc. is a string
        .map((m) => m[1]),
    );
    if (!dates.size) continue;
    for (const t of src.matchAll(/sql`((?:[^`\\]|\\.)*)`/g)) {
      for (const [, expr] of t[1].matchAll(/\$\{\s*(\w+)\s*\}/g)) {
        const line = src.slice(0, t.index).split("\n").length;
        check(`${file}:${line}: Date "${expr}" interpolated into sql\`\` (use .toISOString())`, !dates.has(expr));
      }
    }
  }
}

// ─── Key management is session-only ──────────────────────────────────────
{
  // A key must never be able to mint or revoke keys: nothing under
  // src/app/api may import the key-management commands or actions.
  const walkAll = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walkAll(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : [],
    );
  for (const file of walkAll("src/app/api")) {
    const src = readFileSync(file, "utf8");
    check(
      `${file}: does not reach key management`,
      !/domain\/api-keys|settings\/api-keys\/actions/.test(src),
    );
  }
}

// ─── OpenAPI ─────────────────────────────────────────────────────────────
{
  const doc = buildOpenApi(ROUTES, "https://jetnine.com");
  let count = 0;
  for (const [path, methods] of Object.entries(doc.paths)) {
    for (const [method, op] of Object.entries(methods as Record<string, Record<string, unknown>>)) {
      count++;
      check(`${method} ${path}: x-scope`, typeof op["x-scope"] === "string");
      check(`${method} ${path}: x-approval`, typeof op["x-approval"] === "string");
      const responses = op.responses as Record<string, unknown>;
      // Until the approval queue exists, nothing may promise a 202.
      check(`${method} ${path}: no 202 before the approval queue`, !("202" in responses));
      if (op["x-approval"] === "always") check(`${method} ${path}: documents the 403 refusal`, "403" in responses);
    }
  }
  check("one OpenAPI operation per route", count === ROUTES.length, { count, routes: ROUTES.length });
  check("OpenAPI serializes", JSON.stringify(doc).length > 1000);
}

// ─── Blog shapes agree with validatePostInput ────────────────────────────
{
  const good = { title: "Midsize jets for a long weekend", description: "What to book and why.", bodyMd: "# Hello\n\nBody." };
  const cases: [string, unknown, boolean][] = [
    ["minimal post", good, true],
    ["with slug and tags", { ...good, slug: "midsize-jets", tags: ["guides"], status: "published" }, true],
    ["title too long", { ...good, title: "x".repeat(61) }, false],
    ["description too long", { ...good, description: "x".repeat(161) }, false],
    ["missing body", { title: good.title, description: good.description }, false],
    ["bad slug", { ...good, slug: "Not A Slug" }, false],
  ];
  for (const [name, input, expected] of cases) {
    const legacy = validatePostInput(input, { partial: false }).ok;
    const zod = PostCreate.safeParse(input).success;
    check(`create "${name}": validator ${legacy}, expected ${expected}`, legacy === expected);
    check(`create "${name}": zod ${zod}, validator ${legacy}`, zod === legacy);
  }
  const partial: [string, unknown, boolean][] = [
    ["status only", { status: "draft" }, true],
    ["empty object", {}, true],
    ["title too long", { title: "x".repeat(61) }, false],
  ];
  for (const [name, input, expected] of partial) {
    const legacy = validatePostInput(input, { partial: true }).ok;
    const zod = PostUpdate.safeParse(input).success;
    check(`update "${name}": validator ${legacy}, expected ${expected}`, legacy === expected);
    check(`update "${name}": zod ${zod}, validator ${legacy}`, zod === legacy);
  }
}

if (failures) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("check:api — all checks passed.");
process.exit(0);
