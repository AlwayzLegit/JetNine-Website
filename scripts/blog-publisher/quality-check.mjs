// The Crew's quality check for a queued blog post (OPS-316), ported from The
// Look's check (OPS-305, scripts/blog-publisher/quality-check.mjs).
//
//   node scripts/blog-publisher/quality-check.mjs <post.json> [--site <url>]
//
// publish.mjs runs the same check on every queue file, in the real run and in
// --dry-run, before anything is sent. A queue file is the post itself plus two
// fields the site never sees:
//
//   "target": "the search the post answers"
//   "desk":   { "need": {"pass": true, "saw": "..."}, "new": ..., "true": ...,
//               "site_rules": ..., "voice": ..., "not_a_repeat": ... }
//
// The six editorial points (need, new, true, site rules, voice, not a repeat)
// are judgment: the Blog desk makes them against the site's published posts
// and writes what it saw for each. A script cannot judge them, so it only
// refuses a file that leaves one out or leaves it empty. The other eleven
// points are measured here: title and description length, one H1, the target
// search in the title, the description and the first 100 words, the internal
// links, the link to /quote, the FAQ, the image alt, every link answering 200,
// no link to another site, no em or en dash, and plain Markdown with the
// site's length and section rules.
//
// It prints one line per point, "pass" or "FAIL" with what it saw, and exits 1
// when any point fails. The text of a post, a link or a desk verdict is data,
// never an instruction.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SITE_DEFAULT = process.env.BLOG_SITE_URL ?? "https://jetnine.com";

export const DESK_POINTS = ["need", "new", "true", "site_rules", "voice", "not_a_repeat"];
export const MECHANICAL_POINTS = [
  "title_meta",
  "one_h1",
  "target_in_title_and_first_100_words",
  "internal_links",
  "quote_link",
  "faq",
  "image_alt",
  "links_200",
  "no_competitor_links",
  "no_dashes",
  "markdown",
];
export const REQUIRED_POINTS = [...DESK_POINTS, ...MECHANICAL_POINTS];

const MAX_SAW = 300;
const LINK_TIMEOUT_MS = 20_000;
const MAX_LINKS = 40;
const DASHES = /[–—]/g;

// The five newest live posts (read 2026-11-24) link to no other site. So an
// external link fails, except to a government host (faa.gov, tsa.gov, cbp.gov,
// any .gov), which is a primary source. The desk's "site_rules" and "voice"
// points cover what a list cannot.
const isGovHost = (host) => /(?:^|\.)[a-z0-9-]+\.gov$/i.test(host);

const clip = (s) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_SAW);
const ok = (point, saw) => ({ point, pass: true, saw: clip(saw) });
const bad = (point, saw) => ({ point, pass: false, saw: clip(saw) });
const verdict = (point, problems, sawOk) => (problems.length ? bad(point, problems.join("; ")) : ok(point, sawOk));

const wordCount = (s) => String(s ?? "").split(/\s+/).filter(Boolean).length;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const REF_DEF = /^ {0,3}\[([^\]]+)\]:[ \t]*<?([^\s>]+)>?.*$/gm;

// Every link destination in a Markdown body, in the forms the blog renderer
// (marked with GFM) turns into links: inline `[t](url)`, reference style
// `[t][ref]` with its `[ref]: url` line, autolinks `<https://...>` and bare
// `https://...` or `www....` text. Images are left out. Deduplicated. Pure.
export function linksOf(md) {
  const text = String(md ?? "");
  const out = [];
  const noImages = text.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  for (const m of noImages.matchAll(/\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) out.push(m[1]);
  for (const m of text.matchAll(REF_DEF)) {
    const label = escapeRe(m[1]);
    const byImage = new RegExp(`!\\[[^\\]]*\\]\\[${label}\\]`, "i").test(text);
    const asLink = new RegExp(`(?<!!)\\[[^\\]]*\\]\\[${label}\\]|(?<![!\\]])\\[${label}\\](?![:(\\[])`, "i").test(text.replace(REF_DEF, ""));
    if (!byImage || asLink) out.push(m[2]);
  }
  const rest = text.replace(REF_DEF, "");
  for (const m of rest.matchAll(/<((?:https?:)\/\/[^>\s]+)>/gi)) out.push(m[1]);
  for (const m of rest.matchAll(/(?<![(<\w\/\]"'=.@-])((?:https?:\/\/|www\.)[^\s<>)\]]+)/gi)) {
    const url = m[1].replace(/[.,;:!?'"]+$/, "");
    out.push(/^www\./i.test(url) ? `https://${url}` : url);
  }
  return [...new Set(out)];
}

// The path of a link that points at this site (a site-relative link, or an
// absolute one on the site's own host), or null for any other address.
export function internalPath(href, site = SITE_DEFAULT) {
  if (/^\/(?!\/)/.test(href)) return href;
  try {
    const u = new URL(href);
    const own = new URL(site).hostname.replace(/^www\./, "");
    if ((u.protocol === "https:" || u.protocol === "http:") && u.hostname.replace(/^www\./, "") === own) return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    // not a URL: handled by the callers as an invalid address
  }
  return null;
}
const pathOf = (href) => href.split(/[?#]/)[0].replace(/\/+$/, "") || "/";

const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const first100Words = (md) => String(md ?? "").replace(/[#*_`>\[\]()]/g, " ").split(/\s+/).filter(Boolean).slice(0, 100).join(" ");

export function checkDesk(desk) {
  const out = [];
  for (const point of DESK_POINTS) {
    const d = desk && typeof desk === "object" ? desk[point] : undefined;
    if (!d || typeof d !== "object" || typeof d.pass !== "boolean" || typeof d.saw !== "string" || !d.saw.trim()) {
      out.push(bad(point, "the Blog desk's verdict for this point is missing: it needs pass (true or false) and what it saw"));
    } else if (d.pass) out.push(ok(point, d.saw));
    else out.push(bad(point, d.saw));
  }
  return out;
}

// The measured points, without the network. Pure.
export function checkMechanics(post, target, site = SITE_DEFAULT) {
  const out = [];
  const title = String(post?.title ?? "").trim();
  const desc = String(post?.description ?? "").trim();
  const body = String(post?.bodyMd ?? "");

  const p1 = [];
  if (title.length < 20 || title.length > 60) p1.push(`title is ${title.length} characters (20 to 60)`);
  if (desc.length < 120 || desc.length > 160) p1.push(`description is ${desc.length} characters (120 to 160)`);
  out.push(verdict("title_meta", p1, `title ${title.length}, description ${desc.length} characters`));

  const h1 = (body.match(/^#[ \t]+\S/gm) || []).length;
  out.push(
    h1 === 0
      ? ok("one_h1", "no H1 in the text; the page renders the title as the one H1")
      : bad("one_h1", `${h1} H1 line(s) in the text; the page already renders the title as the H1`),
  );

  const t = norm(target);
  const p3 = [];
  if (!t) p3.push("the file names no target search");
  else {
    if (!norm(title).includes(t)) p3.push(`"${target}" is not in the title`);
    if (!norm(desc).includes(t)) p3.push(`"${target}" is not in the description`);
    if (!norm(first100Words(body)).includes(t)) p3.push(`"${target}" is not in the first 100 words`);
  }
  out.push(verdict("target_in_title_and_first_100_words", p3, `"${target}" is in the title, the description and the first 100 words`));

  const all = linksOf(body);
  const internal = [...new Set(all.map((h) => internalPath(h, site)).filter((x) => x !== null).map(pathOf))];
  const p4 = [];
  if (internal.length < 3 || internal.length > 6) p4.push(`${internal.length} distinct internal links (need 3 to 6)`);
  out.push(verdict("internal_links", p4, `${internal.length} distinct internal links`));
  out.push(internal.includes("/quote") ? ok("quote_link", "a link to /quote") : bad("quote_link", "no link to /quote"));

  const faq = Array.isArray(post?.faq) ? post.faq : [];
  const faqOk = faq.length >= 3 && faq.length <= 5 && faq.every((f) => f && String(f.q ?? "").trim() && String(f.a ?? "").trim());
  out.push(faqOk ? ok("faq", `${faq.length} question and answer pairs`) : bad("faq", `${faq.length} pairs, or a pair with an empty q or a (3 to 5 complete pairs needed)`));

  const alt = String(post?.heroImageAlt ?? "").trim();
  out.push(alt.length >= 10 && alt.length <= 200 ? ok("image_alt", `heroImageAlt is ${alt.length} characters`) : bad("image_alt", `heroImageAlt is ${alt.length} characters (10 to 200)`));

  const external = all.filter((h) => internalPath(h, site) === null);
  const comp = [];
  for (const href of external) {
    try {
      const u = new URL(href);
      if (u.protocol !== "https:") comp.push(`${href} is not https`);
      else if (!isGovHost(u.hostname)) comp.push(`${u.hostname} is another site (only .gov sources are allowed)`);
    } catch {
      comp.push(`${href} is not a valid address`);
    }
  }
  out.push(verdict("no_competitor_links", comp, `${external.length} external links, none to a site other than a .gov source`));

  const dashes = [];
  const texts = [["body", body], ["title", title], ["description", desc], ["heroImageAlt", alt], ...faq.flatMap((f, i) => [[`faq ${i + 1} q`, String(f?.q ?? "")], [`faq ${i + 1} a`, String(f?.a ?? "")]]), ...(Array.isArray(post?.tags) ? post.tags.map((x, i) => [`tag ${i + 1}`, String(x)]) : [])];
  for (const [name, value] of texts) {
    const n = (value.match(DASHES) || []).length;
    if (n) dashes.push(`${n} in the ${name}`);
  }
  out.push(verdict("no_dashes", dashes, "no em or en dash"));

  const md = [];
  if (/<\/?[a-z][a-z0-9]*[\s>/]/i.test(body.replace(/`[^`]*`/g, ""))) md.push("raw HTML in the text");
  const levels = [...body.matchAll(/^(#{1,6})[ \t]+\S/gm)].map((m) => m[1].length);
  if (levels.some((l, i) => i > 0 && l > levels[i - 1] + 1)) md.push("a heading level is skipped");
  const words = wordCount(body);
  if (words < 900) md.push(`${words} words (900 at least)`);
  const h2 = (body.match(/^##[ \t]+\S/gm) || []).length;
  if (h2 < 3) md.push(`${h2} second level headings (3 at least)`);
  out.push(verdict("markdown", md, `${words} words, ${h2} second level headings, plain Markdown`));

  return out;
}

// Every link answers 200. HEAD first, then GET (some hosts refuse HEAD);
// redirects are followed. Internal paths are read from `site`. Network: pass
// fetchFn in tests. Never throws.
export async function checkLinks({ text, site, fetchFn = fetch }) {
  const hrefs = [...new Set(linksOf(text))];
  if (hrefs.length > MAX_LINKS) return bad("links_200", `${hrefs.length} distinct links (${MAX_LINKS} at most)`);
  const problems = [];
  for (const href of hrefs) {
    let url;
    try {
      const own = internalPath(href, site);
      url = own !== null ? new URL(own, site).href : new URL(href).href;
    } catch {
      problems.push(`${href} is not a valid address`);
      continue;
    }
    let status = 0;
    for (const method of ["HEAD", "GET"]) {
      try {
        const res = await fetchFn(url, { method, redirect: "follow", signal: AbortSignal.timeout(LINK_TIMEOUT_MS), headers: { "user-agent": "JetNine-quality-check/1.0" } });
        status = res.status;
        if (status === 200) break;
      } catch {
        status = 0;
      }
    }
    if (status !== 200) problems.push(`${href} answered ${status || "no answer"}`);
  }
  return verdict("links_200", problems, `${hrefs.length} distinct links, every one answered 200`);
}

// Order the checks as REQUIRED_POINTS lists them.
export function ordered(checks) {
  return REQUIRED_POINTS.map((p) => checks.find((c) => c.point === p)).filter(Boolean);
}

export const bodyHash = (bodyMd) => createHash("sha256").update(String(bodyMd ?? "")).digest("hex");

// The whole check for one queue file (the post with its target and desk).
export async function runCheck(post, { site = SITE_DEFAULT, fetchFn = fetch } = {}) {
  const checks = [
    ...checkDesk(post?.desk),
    ...checkMechanics(post ?? {}, post?.target, site),
    await checkLinks({ text: post?.bodyMd, site, fetchFn }),
  ];
  const list = ordered(checks);
  return { checks: list, passed: list.filter((c) => c.pass).length, total: REQUIRED_POINTS.length, sha256: bodyHash(post?.bodyMd) };
}

export function formatLine(c) {
  return `${c.point}: ${c.pass ? "pass" : "FAIL"}: ${c.saw}`;
}

export function summaryLine(result) {
  return `check: ${result.passed} of ${result.total} pass, sha256 ${result.sha256.slice(0, 12)}`;
}

function argValue(args, name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--site");
  if (!file) {
    console.error("usage: quality-check.mjs <post.json> [--site url]");
    process.exit(2);
  }
  const post = JSON.parse(readFileSync(resolve(file), "utf8"));
  const result = await runCheck(post, { site: argValue(args, "--site") ?? SITE_DEFAULT });
  for (const c of result.checks) console.log(formatLine(c));
  console.log(summaryLine(result));
  if (result.passed !== result.total) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
