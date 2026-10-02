/* eslint-disable no-console */
/**
 * SEO snapshot + diff.
 *
 * Captures, for every URL in a running build's sitemap, the things search
 * engines index: status / redirect target, <title>, canonical, meta
 * description, meta robots and every JSON-LD block. A second mode diffs two
 * snapshots so a redesign (or any refactor) can be proven not to have dropped
 * an indexed URL or a structured-data block.
 *
 * Capture:
 *   pnpm tsx scripts/audit-seo-snapshot.mts --base http://localhost:3200 --out before.json
 *   pnpm tsx scripts/audit-seo-snapshot.mts --base http://localhost:3000 --out after.json \
 *     --include-paths before.json     # also fetch every path of an earlier snapshot,
 *                                     # even if this build's sitemap no longer lists it
 *
 * Diff:
 *   pnpm tsx scripts/audit-seo-snapshot.mts --diff before.json after.json
 *
 * Exit code (diff): 1 if a path is missing (not served, or dropped from the
 * sitemap), a 200 became non-200, a canonical changed, or a JSON-LD @type
 * disappeared from a path; 0 otherwise. Capture exits 1 only if the sitemap
 * cannot be read.
 *
 * Requests use a Googlebot user agent: Next 15 streams metadata into <body>
 * for ordinary browsers but blocks it into <head> for known bots, and the bot
 * view is the one that matters here. No dependencies beyond Node's fetch.
 */
import { readFile, writeFile } from "node:fs/promises";

// ---------------------------------------------------------------------------
// Types

type JsonLdBlock = { types: string[]; json: unknown; error?: string };

type PathRecord = {
  status: number;
  location?: string;
  inSitemap: boolean;
  title: string | null;
  canonical: string | null;
  description: string | null;
  robots: string | null;
  jsonld: JsonLdBlock[];
  /** Body of non-HTML text responses (robots.txt, llms.txt), truncated. */
  body?: string;
  error?: string;
};

type Snapshot = {
  capturedAt: string;
  base: string;
  paths: Record<string, PathRecord>;
};

// ---------------------------------------------------------------------------
// CLI

const USER_AGENT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const CONCURRENCY = 6;
const TIMEOUT_MS = 20_000;
const EXTRA_PATHS = ["/robots.txt", "/llms.txt"];
const MAX_BODY = 20_000;

function usage(): never {
  console.error(
    [
      "Usage:",
      "  tsx scripts/audit-seo-snapshot.mts --base <url> --out <file.json> [--include-paths <snapshot.json>]",
      "  tsx scripts/audit-seo-snapshot.mts --diff <before.json> <after.json>",
    ].join("\n"),
  );
  process.exit(2);
}

function argValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  if (i === -1) return undefined;
  const v = args[i + 1];
  if (!v || v.startsWith("--")) usage();
  return v;
}

// ---------------------------------------------------------------------------
// HTML scanning (regex based — good enough for server-rendered Next output)

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  middot: "·",
  copy: "©",
  reg: "®",
  trade: "™",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, ent: string) => {
    if (ent[0] === "#") {
      const code = ent[1] === "x" || ent[1] === "X" ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return NAMED_ENTITIES[ent.toLowerCase()] ?? m;
  });
}

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const name = m[1].toLowerCase();
    if (name in attrs) continue; // HTML: first occurrence wins
    attrs[name] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return attrs;
}

/** Remove regions whose contents must not be scanned for head tags. */
function stripOpaque(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "")
    .replace(/<template\b[^>]*>[\s\S]*?<\/template\s*>/gi, "")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg\s*>/gi, "")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript\s*>/gi, "");
}

function collapse(s: string): string {
  return decodeEntities(s).replace(/\s+/g, " ").trim();
}

function jsonLdTypes(json: unknown): string[] {
  const out: string[] = [];
  const typeOf = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const t = (node as Record<string, unknown>)["@type"];
    if (typeof t === "string") out.push(t);
    else if (Array.isArray(t)) out.push(t.filter((x): x is string => typeof x === "string").join("+"));
  };
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== "object") return;
    typeOf(node);
    const graph = (node as Record<string, unknown>)["@graph"];
    if (Array.isArray(graph)) graph.forEach(typeOf);
  };
  visit(json);
  return out;
}

function scanHtml(html: string): Pick<PathRecord, "title" | "canonical" | "description" | "robots" | "jsonld"> {
  // JSON-LD first, from the raw document.
  const jsonld: JsonLdBlock[] = [];
  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let m: RegExpExecArray | null;
  while ((m = scriptRe.exec(html))) {
    const type = (parseAttrs(m[1]).type ?? "").trim().toLowerCase();
    if (type !== "application/ld+json") continue;
    const raw = m[2].trim();
    try {
      const json: unknown = JSON.parse(raw);
      jsonld.push({ types: jsonLdTypes(json), json });
    } catch (e) {
      jsonld.push({ types: ["<invalid JSON>"], json: raw.slice(0, 2000), error: String(e) });
    }
  }

  const doc = stripOpaque(html);

  const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(doc);
  const title = titleMatch ? collapse(titleMatch[1]) : null;

  let canonical: string | null = null;
  let description: string | null = null;
  let robots: string | null = null;
  const tagRe = /<(link|meta)\b([^>]*)>/gi;
  while ((m = tagRe.exec(doc))) {
    const tag = m[1].toLowerCase();
    const a = parseAttrs(m[2]);
    if (tag === "link") {
      const rels = (a.rel ?? "").toLowerCase().split(/\s+/);
      if (canonical === null && rels.includes("canonical") && a.href !== undefined) canonical = a.href.trim();
    } else {
      const name = (a.name ?? "").trim().toLowerCase();
      if (description === null && name === "description" && a.content !== undefined) description = collapse(a.content);
      if (robots === null && name === "robots" && a.content !== undefined) robots = collapse(a.content);
    }
  }

  return { title, canonical, description, robots, jsonld };
}

// ---------------------------------------------------------------------------
// Capture

async function get(url: string): Promise<Response> {
  return fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
  });
}

function toPath(loc: string): string {
  try {
    const u = new URL(loc);
    return (u.pathname || "/") + u.search;
  } catch {
    return loc.startsWith("/") ? loc : `/${loc}`;
  }
}

function locs(xml: string, container: "url" | "sitemap"): string[] {
  const out: string[] = [];
  const blockRe = new RegExp(`<(?:[\\w-]+:)?${container}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${container}\\s*>`, "gi");
  let b: RegExpExecArray | null;
  while ((b = blockRe.exec(xml))) {
    // The first <loc> that is not namespaced (skips <image:loc>, <video:loc>, ...).
    const loc = /<loc\b[^>]*>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/loc\s*>/i.exec(b[1]);
    if (loc) out.push(decodeEntities(loc[1].trim()));
  }
  return out;
}

async function readSitemap(base: string): Promise<string[]> {
  const seen = new Set<string>();
  const paths: string[] = [];
  const queue = ["/sitemap.xml"];
  while (queue.length) {
    const p = queue.shift()!;
    if (seen.has(p)) continue;
    seen.add(p);
    const res = await get(base + p);
    if (res.status !== 200) throw new Error(`GET ${p} -> ${res.status}`);
    const xml = await res.text();
    if (/<(?:[\w-]+:)?sitemapindex\b/i.test(xml)) {
      for (const loc of locs(xml, "sitemap")) queue.push(toPath(loc));
    } else {
      for (const loc of locs(xml, "url")) paths.push(toPath(loc));
    }
  }
  return paths;
}

async function capturePath(base: string, path: string, inSitemap: boolean): Promise<PathRecord> {
  const rec: PathRecord = {
    status: 0,
    inSitemap,
    title: null,
    canonical: null,
    description: null,
    robots: null,
    jsonld: [],
  };
  try {
    const res = await get(base + path);
    rec.status = res.status;
    const location = res.headers.get("location");
    if (location !== null) {
      // Relative to the build under test so before/after compare cleanly.
      rec.location = location.startsWith(base) ? location.slice(base.length) || "/" : location;
    }
    const ctype = (res.headers.get("content-type") ?? "").toLowerCase();
    const text = await res.text();
    if (ctype.includes("html")) {
      Object.assign(rec, scanHtml(text));
    } else if (ctype.startsWith("text/")) {
      rec.body = text.length > MAX_BODY ? text.slice(0, MAX_BODY) : text;
    }
  } catch (e) {
    rec.error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  }
  return rec;
}

async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]);
  });
  await Promise.all(workers);
}

async function capture(baseArg: string, out: string, includeFrom?: string): Promise<void> {
  const base = baseArg.replace(/\/+$/, "");
  let sitemapPaths: string[];
  try {
    sitemapPaths = await readSitemap(base);
  } catch (e) {
    console.error(`Could not read sitemap from ${base}: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }
  const inSitemap = new Set(sitemapPaths);
  const all = new Set<string>([...sitemapPaths, ...EXTRA_PATHS]);
  if (includeFrom) {
    const prev = JSON.parse(await readFile(includeFrom, "utf8")) as Snapshot;
    for (const p of Object.keys(prev.paths)) all.add(p);
  }
  const list = [...all].sort();
  console.error(`Sitemap: ${sitemapPaths.length} URLs (${inSitemap.size} unique); fetching ${list.length} paths…`);

  const paths: Record<string, PathRecord> = {};
  let done = 0;
  await pool(list, CONCURRENCY, async (p) => {
    paths[p] = await capturePath(base, p, inSitemap.has(p));
    done++;
    if (done % 25 === 0 || done === list.length) console.error(`  ${done}/${list.length}`);
  });

  const sorted: Record<string, PathRecord> = {};
  for (const p of list) sorted[p] = paths[p];
  const snap: Snapshot = { capturedAt: new Date().toISOString(), base, paths: sorted };
  await writeFile(out, JSON.stringify(snap, null, 2) + "\n");

  // Summary
  const statuses = new Map<string, number>();
  const types = new Map<string, number>();
  for (const r of Object.values(sorted)) {
    const k = r.error ? `ERR` : String(r.status);
    statuses.set(k, (statuses.get(k) ?? 0) + 1);
    for (const b of r.jsonld) for (const t of b.types) types.set(t, (types.get(t) ?? 0) + 1);
  }
  const fmt = (m: Map<string, number>) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join(", ");
  console.log(`Wrote ${out}`);
  console.log(`Paths: ${list.length}`);
  console.log(`Status: ${fmt(statuses)}`);
  console.log(`JSON-LD types (occurrences): ${fmt(types) || "none"}`);
  const errs = Object.entries(sorted).filter(([, r]) => r.error);
  if (errs.length) for (const [p, r] of errs) console.log(`  error ${p}: ${r.error}`);
}

// ---------------------------------------------------------------------------
// Diff

function short(v: unknown): string {
  const s = v === undefined ? "(absent)" : typeof v === "string" ? JSON.stringify(v) : JSON.stringify(v) ?? String(v);
  return s.length > 80 ? `${s.slice(0, 77)}...` : s;
}

function deepDiff(a: unknown, b: unknown, path: string, out: string[]): void {
  const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
  if (Array.isArray(a) && Array.isArray(b)) {
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) deepDiff(a[i], b[i], `${path}[${i}]`, out);
    return;
  }
  if (isObj(a) && isObj(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of [...keys].sort()) deepDiff(a[k], b[k], path ? `${path}.${k}` : k, out);
    return;
  }
  if (JSON.stringify(a) !== JSON.stringify(b)) out.push(`${path || "(root)"}: ${short(a)} -> ${short(b)}`);
}

/** Flatten a block into its entities (top-level node, array items, @graph members). */
function entities(block: JsonLdBlock): { key: string; json: unknown }[] {
  const res: { key: string; json: unknown }[] = [];
  const add = (node: unknown) => {
    const t = jsonLdTypes(Array.isArray(node) ? null : node);
    res.push({ key: t.length ? t.join("+") : "(untyped)", json: node });
  };
  const visit = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (node && typeof node === "object" && Array.isArray((node as Record<string, unknown>)["@graph"])) {
      const { ["@graph"]: graph, ...rest } = node as Record<string, unknown>;
      (graph as unknown[]).forEach(add);
      if ("@type" in rest) add(rest);
      return;
    }
    add(node);
  };
  if (block.error) res.push({ key: "<invalid JSON>", json: block.json });
  else visit(block.json);
  return res;
}

function groupEntities(blocks: JsonLdBlock[]): Map<string, unknown[]> {
  const m = new Map<string, unknown[]>();
  for (const b of blocks) for (const e of entities(b)) m.set(e.key, [...(m.get(e.key) ?? []), e.json]);
  return m;
}

async function diff(beforeFile: string, afterFile: string): Promise<void> {
  const before = JSON.parse(await readFile(beforeFile, "utf8")) as Snapshot;
  const after = JSON.parse(await readFile(afterFile, "utf8")) as Snapshot;
  const fatal: string[] = [];
  const lines: string[] = [];
  const section = (title: string, items: string[]) => {
    lines.push("", `## ${title} (${items.length})`);
    if (items.length === 0) lines.push("  none");
    else for (const i of items) lines.push(i);
  };
  const B = before.paths;
  const A = after.paths;
  const common = Object.keys(B).filter((p) => p in A);

  const missing = Object.keys(B).filter((p) => !(p in A));
  const dropped = common.filter((p) => B[p].inSitemap !== false && A[p].inSitemap === false);
  const added = Object.keys(A).filter((p) => !(p in B));
  const addedToSitemap = common.filter((p) => B[p].inSitemap === false && A[p].inSitemap !== false);
  for (const p of missing) fatal.push(`missing path ${p}`);
  for (const p of dropped) fatal.push(`dropped from sitemap ${p}`);

  const statusLines: string[] = [];
  const titleLines: string[] = [];
  const canonLines: string[] = [];
  const descLines: string[] = [];
  const robotsLines: string[] = [];
  const bodyLines: string[] = [];
  const ldLines: string[] = [];

  for (const p of common) {
    const b = B[p];
    const a = A[p];
    const bs = b.error ? `ERR(${b.error})` : String(b.status);
    const as = a.error ? `ERR(${a.error})` : String(a.status);
    if (bs !== as || (b.location ?? "") !== (a.location ?? "")) {
      const loc = (r: PathRecord) => (r.location ? ` -> ${r.location}` : "");
      statusLines.push(`  ${p}: ${bs}${loc(b)}  =>  ${as}${loc(a)}`);
      if (b.status === 200 && a.status !== 200) fatal.push(`status ${p} 200 -> ${as}`);
    }
    if (b.title !== a.title) titleLines.push(`  ${p}\n    - ${b.title}\n    + ${a.title}`);
    if (b.canonical !== a.canonical) {
      canonLines.push(`  ${p}: ${b.canonical} -> ${a.canonical}`);
      fatal.push(`canonical ${p}`);
    }
    if (b.description !== a.description) descLines.push(`  ${p}\n    - ${b.description}\n    + ${a.description}`);
    if (b.robots !== a.robots) robotsLines.push(`  ${p}: ${b.robots} -> ${a.robots}`);
    if ((b.body ?? null) !== (a.body ?? null)) bodyLines.push(`  ${p}: body changed (${b.body?.length ?? 0} -> ${a.body?.length ?? 0} chars)`);

    const gb = groupEntities(b.jsonld);
    const ga = groupEntities(a.jsonld);
    const out: string[] = [];
    const typesBefore = new Set(b.jsonld.flatMap((x) => x.types));
    const typesAfter = new Set(a.jsonld.flatMap((x) => x.types));
    for (const t of typesBefore) if (!typesAfter.has(t)) fatal.push(`JSON-LD ${t} gone from ${p}`);
    if (b.jsonld.length !== a.jsonld.length) out.push(`    blocks: ${b.jsonld.length} -> ${a.jsonld.length}`);
    for (const k of new Set([...gb.keys(), ...ga.keys()])) {
      const eb = gb.get(k) ?? [];
      const ea = ga.get(k) ?? [];
      if (ea.length < eb.length) out.push(`    - ${k}${eb.length > 1 ? ` (${eb.length} -> ${ea.length})` : ""} missing`);
      if (ea.length > eb.length) out.push(`    + ${k}${ea.length > 1 ? ` (${eb.length} -> ${ea.length})` : ""} added`);
      for (let i = 0; i < Math.min(eb.length, ea.length); i++) {
        const changes: string[] = [];
        deepDiff(eb[i], ea[i], "", changes);
        if (changes.length) {
          out.push(`    ~ ${k}${eb.length > 1 ? `[${i}]` : ""}: ${changes.length} change(s)`);
          for (const c of changes.slice(0, 30)) out.push(`        ${c}`);
          if (changes.length > 30) out.push(`        ... ${changes.length - 30} more`);
        }
      }
    }
    if (out.length) ldLines.push(`  ${p}`, ...out);
  }

  lines.push(`# SEO snapshot diff`, `before: ${beforeFile} (${before.base}, ${before.capturedAt}, ${Object.keys(B).length} paths)`);
  lines.push(`after:  ${afterFile} (${after.base}, ${after.capturedAt}, ${Object.keys(A).length} paths)`);
  section("Paths missing in after", missing.map((p) => `  ${p}`));
  section("Paths dropped from the sitemap (still served)", dropped.map((p) => `  ${p} (status ${A[p].status})`));
  section("Paths added in after", added.map((p) => `  ${p} (status ${A[p].status}${A[p].inSitemap ? "" : ", not in sitemap"})`));
  if (addedToSitemap.length) section("Paths newly listed in the sitemap", addedToSitemap.map((p) => `  ${p}`));
  section("Status / redirect changes", statusLines);
  section("Title changes", titleLines);
  section("Canonical changes", canonLines);
  section("Description changes", descLines);
  section("Robots changes", robotsLines);
  if (bodyLines.length) section("Text body changes", bodyLines);
  section("JSON-LD changes", ldLines);
  lines.push("", fatal.length ? `FAIL: ${fatal.length} blocking issue(s)` : "PASS: no blocking issues");
  for (const f of fatal.slice(0, 50)) lines.push(`  ! ${f}`);
  if (fatal.length > 50) lines.push(`  ... ${fatal.length - 50} more`);
  console.log(lines.join("\n"));
  process.exitCode = fatal.length ? 1 : 0;
}

// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const diffAt = args.indexOf("--diff");
if (diffAt !== -1) {
  const [b, a] = [args[diffAt + 1], args[diffAt + 2]];
  if (!b || !a) usage();
  await diff(b, a);
} else {
  const base = argValue(args, "--base");
  const out = argValue(args, "--out");
  if (!base || !out) usage();
  await capture(base, out, argValue(args, "--include-paths"));
}
