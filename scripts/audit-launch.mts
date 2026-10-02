/* eslint-disable no-console */
/**
 * Launch audit (redesign phase 6): every sitemap URL plus the app entry
 * points, at phone width (390px) and desktop (1440px).
 *
 *   - Phone: horizontal overflow (page wider than the viewport, with the
 *     widest offending elements), and tap targets smaller than 44px on
 *     controls (buttons, inputs, selects, nav and button-styled links).
 *     Inline text links inside a sentence are exempt (WCAG 2.5.8 allows
 *     them); anything under 24px is listed as a failure, 24–43px as a
 *     warning.
 *   - Desktop and phone: axe-core WCAG 2.1 A/AA.
 *
 *   pnpm tsx scripts/audit-launch.mts --base http://localhost:3300 \
 *     [--out tmp/audit/launch.json] [--paths /,/contact] [--limit 20]
 *
 * Exit code 1 when any page has overflow, a sub-24px control, an axe
 * violation of impact serious/critical, or does not load.
 */
import { chromium, type Browser } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const CHROMIUM_PATH =
  process.env.PLAYWRIGHT_CHROMIUM ??
  (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : "/opt/pw-browsers/chromium-1194/chrome-linux/chrome");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const BASE = (arg("base") ?? process.env.AUDIT_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const OUT = resolve(process.cwd(), arg("out") ?? "tmp/audit/launch.json");
const LIMIT = Number(arg("limit") ?? "0");

// App entry points that are not in the sitemap but must work on a phone.
const EXTRA_PATHS = [
  "/quote/mission",
  "/quote/aircraft",
  "/quote/contact",
  "/quote/review",
  "/sign-in",
  "/request/" + "0".repeat(48),
  "/this-page-does-not-exist",
];

type Small = { selector: string; text: string; w: number; h: number };
type Over = { selector: string; right: number; width: number };

type PageResult = {
  path: string;
  status: number | null;
  error?: string;
  phone?: { scrollWidth: number; overflow: Over[]; tooSmall: Small[]; tight: Small[] };
  axe: { viewport: string; id: string; impact: string | null; nodes: number; sample: string }[];
};

async function sitemapPaths(): Promise<string[]> {
  const res = await fetch(`${BASE}/sitemap.xml`);
  const xml = await res.text();
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
  return locs.map((u) => {
    try {
      return new URL(u).pathname;
    } catch {
      return u;
    }
  });
}

async function phoneChecks(browser: Browser, path: string, r: PageResult) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  // tsx/esbuild wraps named functions with a `__name` helper that does not
  // exist inside the page; define a no-op so page.evaluate bodies run.
  await ctx.addInitScript("globalThis.__name = (f) => f;");
  const page = await ctx.newPage();
  try {
    const resp = await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 30_000 });
    r.status = resp?.status() ?? null;
    await page.waitForTimeout(250);
    r.phone = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const describe = (el: Element) => {
        const id = el.id ? `#${el.id}` : "";
        const cls =
          typeof (el as HTMLElement).className === "string"
            ? "." + (el as HTMLElement).className.trim().split(/\s+/).slice(0, 3).join(".")
            : "";
        return `${el.tagName.toLowerCase()}${id}${cls === "." ? "" : cls}`;
      };
      const visible = (el: Element) => {
        const s = getComputedStyle(el);
        if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) === 0) return false;
        const b = el.getBoundingClientRect();
        return b.width > 0 && b.height > 0;
      };
      // Overflow: elements whose right edge passes the viewport, excluding
      // children of horizontal scrollers (intended strips).
      const inScroller = (el: Element) => {
        for (let p = el.parentElement; p; p = p.parentElement) {
          const s = getComputedStyle(p);
          if ((s.overflowX === "auto" || s.overflowX === "scroll" || s.overflowX === "hidden") && p !== document.body && p !== document.documentElement) return true;
        }
        return false;
      };
      const overflow: { selector: string; right: number; width: number }[] = [];
      for (const el of Array.from(document.body.querySelectorAll("*"))) {
        if (!visible(el)) continue;
        const b = el.getBoundingClientRect();
        if (b.right > vw + 1 && !inScroller(el)) {
          overflow.push({ selector: describe(el), right: Math.round(b.right), width: Math.round(b.width) });
        }
      }
      overflow.sort((a, b) => b.right - a.right);

      // Tap targets.
      const controls = Array.from(
        document.querySelectorAll(
          'button, input:not([type="hidden"]), select, textarea, [role="button"], [role="tab"], [role="switch"], a',
        ),
      );
      const tooSmall: { selector: string; text: string; w: number; h: number }[] = [];
      const tight: { selector: string; text: string; w: number; h: number }[] = [];
      for (const el of controls) {
        if (!visible(el)) continue;
        if (el.closest("[aria-hidden='true']")) continue;
        // Skip links are 1px until focused; range inputs are judged by their thumb.
        if ((el as HTMLElement).classList.contains("sr-only")) continue;
        if ((el as HTMLInputElement).type === "range") continue;
        // An input inside a label/field box: the box is the real target.
        if (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA") {
          const box = el.closest("label") ?? el.parentElement;
          if (box && box.getBoundingClientRect().height >= 44) continue;
        }
        if (el.tagName === "A") {
          // Inline text links inside running text are exempt.
          const parent = el.parentElement;
          const display = getComputedStyle(el).display;
          const inSentence =
            display === "inline" &&
            parent != null &&
            ["P", "LI", "SPAN", "DD", "TD", "SMALL", "LABEL", "FIGCAPTION", "BLOCKQUOTE", "EM", "STRONG"].includes(parent.tagName) &&
            (parent.textContent ?? "").trim().length > (el.textContent ?? "").trim().length + 12;
          if (inSentence) continue;
        }
        const t = (el as HTMLInputElement).type;
        if (t === "checkbox" || t === "radio") {
          // Judge the label, which is the real target.
          const label = el.closest("label");
          if (label) {
            const lb = label.getBoundingClientRect();
            if (lb.height >= 44) continue;
          }
        }
        const b = el.getBoundingClientRect();
        const w = Math.round(b.width);
        const h = Math.round(b.height);
        const text = ((el.textContent ?? "") || (el as HTMLElement).getAttribute("aria-label") || "").trim().slice(0, 40);
        const row = { selector: describe(el), text, w, h };
        if (h < 24 || w < 24) tooSmall.push(row);
        else if (h < 44 || w < 44) tight.push(row);
      }
      return { scrollWidth: document.documentElement.scrollWidth, overflow: overflow.slice(0, 8), tooSmall, tight };
    });
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    for (const v of axe.violations) {
      r.axe.push({
        viewport: "phone",
        id: v.id,
        impact: v.impact ?? null,
        nodes: v.nodes.length,
        sample: v.nodes[0]?.target?.join(" ") ?? "",
      });
    }
  } catch (err) {
    r.error = err instanceof Error ? err.message : String(err);
  } finally {
    await ctx.close();
  }
}

async function desktopAxe(browser: Browser, path: string, r: PageResult) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 30_000 });
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    for (const v of axe.violations) {
      r.axe.push({
        viewport: "desktop",
        id: v.id,
        impact: v.impact ?? null,
        nodes: v.nodes.length,
        sample: v.nodes[0]?.target?.join(" ") ?? "",
      });
    }
  } catch (err) {
    r.error = (r.error ? r.error + "; " : "") + (err instanceof Error ? err.message : String(err));
  } finally {
    await ctx.close();
  }
}

async function main() {
  const only = arg("paths");
  let paths = only ? only.split(",") : [...new Set([...(await sitemapPaths()), ...EXTRA_PATHS])];
  if (LIMIT > 0) paths = paths.slice(0, LIMIT);

  const browser = await chromium.launch({ executablePath: CHROMIUM_PATH, headless: true, args: ["--no-sandbox"] });
  const results: PageResult[] = [];
  const queue = [...paths];
  const workers = Array.from({ length: 4 }, async () => {
    for (let p = queue.shift(); p !== undefined; p = queue.shift()) {
      const r: PageResult = { path: p, status: null, axe: [] };
      await phoneChecks(browser, p, r);
      await desktopAxe(browser, p, r);
      results.push(r);
      const bad =
        (r.phone?.overflow.length ?? 0) + (r.phone?.tooSmall.length ?? 0) + r.axe.filter((a) => a.impact === "serious" || a.impact === "critical").length;
      console.log(`${bad ? "✗" : "✓"} ${p} ${r.status ?? ""}${r.error ? " ERROR " + r.error : ""}`);
    }
  });
  await Promise.all(workers);
  await browser.close();

  results.sort((a, b) => a.path.localeCompare(b.path));
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify({ base: BASE, capturedAt: new Date().toISOString(), results }, null, 2));

  // Summary.
  const overflow = results.filter((r) => (r.phone?.overflow.length ?? 0) > 0);
  const small = results.filter((r) => (r.phone?.tooSmall.length ?? 0) > 0);
  const errors = results.filter((r) => r.error || (r.status ?? 0) >= 500);
  const axeByRule = new Map<string, { impact: string | null; pages: Set<string>; nodes: number; sample: string }>();
  for (const r of results)
    for (const a of r.axe) {
      const k = a.id;
      const e = axeByRule.get(k) ?? { impact: a.impact, pages: new Set<string>(), nodes: 0, sample: `${r.path} ${a.sample}` };
      e.pages.add(r.path);
      e.nodes += a.nodes;
      axeByRule.set(k, e);
    }
  const tightCount = new Map<string, number>();
  for (const r of results) for (const t of r.phone?.tight ?? []) tightCount.set(`${t.selector} "${t.text}" ${t.w}×${t.h}`, (tightCount.get(`${t.selector} "${t.text}" ${t.w}×${t.h}`) ?? 0) + 1);

  console.log(`\n--- ${results.length} pages ---`);
  console.log(`load errors / 5xx: ${errors.length}${errors.length ? " — " + errors.map((r) => `${r.path} (${r.status ?? r.error})`).join(", ") : ""}`);
  console.log(`horizontal overflow at 390px: ${overflow.length}`);
  for (const r of overflow) console.log(`  ${r.path}  scrollWidth ${r.phone!.scrollWidth}: ${r.phone!.overflow.slice(0, 3).map((o) => `${o.selector} → ${o.right}px`).join(" | ")}`);
  console.log(`controls under 24px: ${small.length} pages`);
  for (const r of small) console.log(`  ${r.path}: ${r.phone!.tooSmall.slice(0, 4).map((t) => `${t.selector} "${t.text}" ${t.w}×${t.h}`).join(" | ")}`);
  console.log(`axe rules violated: ${axeByRule.size}`);
  for (const [id, e] of [...axeByRule.entries()].sort((a, b) => b[1].pages.size - a[1].pages.size))
    console.log(`  [${e.impact}] ${id} — ${e.pages.size} pages, ${e.nodes} nodes · e.g. ${e.sample.slice(0, 120)}`);
  console.log(`controls 24–43px (warning), most common:`);
  for (const [k, n] of [...tightCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${n}× ${k}`);
  console.log(`\nreport: ${OUT}`);

  const serious = [...axeByRule.values()].some((e) => e.impact === "serious" || e.impact === "critical");
  process.exit(errors.length || overflow.length || small.length || serious ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
