/* eslint-disable no-console */
/**
 * One-shot audit: visit key pages at mobile + desktop viewports,
 * snap screenshots, run axe-core, report violations.
 *
 * Uses playwright-core with the pre-installed Chromium binary at
 * /opt/pw-browsers because the sandbox blocks the Playwright CDN.
 * Falls back to whatever `PLAYWRIGHT_CHROMIUM` is set to if you
 * run this outside the sandbox.
 */
import { chromium, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const CHROMIUM_PATH =
  process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.AUDIT_BASE_URL ?? "http://localhost:3000";

const OUT_DIR = resolve(process.cwd(), "tmp/audit");

type PageSpec = { path: string; label: string };

const PAGES: PageSpec[] = [
  { path: "/", label: "home" },
  { path: "/aircraft", label: "aircraft-index" },
  { path: "/aircraft/midsize", label: "aircraft-midsize" },
  { path: "/memberships", label: "memberships" },
  { path: "/how-it-works", label: "how-it-works" },
  { path: "/safety", label: "safety" },
  { path: "/about", label: "about" },
  { path: "/contact", label: "contact" },
  { path: "/empty-legs", label: "empty-legs" },
  { path: "/faq", label: "faq" },
  { path: "/quote/mission", label: "quote-mission" },
  { path: "/sign-in", label: "sign-in" },
];

const VIEWPORTS: Array<{ label: string; width: number; height: number }> = [
  { label: "mobile", width: 390, height: 844 }, // iPhone 14
  { label: "desktop", width: 1440, height: 900 },
];

type ScanResult = {
  url: string;
  viewport: string;
  status: "ok" | "error";
  errorMessage?: string;
  violations: Array<{
    id: string;
    impact: string | undefined;
    description: string;
    nodes: number;
    helpUrl: string;
  }>;
};

async function scanPage(
  browser: Browser,
  spec: PageSpec,
  vp: (typeof VIEWPORTS)[number],
): Promise<ScanResult> {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.label === "mobile" ? 3 : 1,
    userAgent:
      vp.label === "mobile"
        ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        : undefined,
  });
  const page: Page = await ctx.newPage();
  const result: ScanResult = {
    url: spec.path,
    viewport: vp.label,
    status: "ok",
    violations: [],
  };

  try {
    const resp = await page.goto(`${BASE}${spec.path}`, {
      waitUntil: "networkidle",
      timeout: 30_000,
    });
    if (!resp || resp.status() >= 400) {
      result.status = "error";
      result.errorMessage = `HTTP ${resp?.status() ?? "no response"}`;
    }

    // Trigger any IntersectionObserver-based reveals by stepping the
    // page through ~viewport-height scrolls before snapping the full
    // page. Otherwise the screenshot shows pre-animation state (opacity
    // 0 / translateY) for everything below the fold — useless for
    // visual review.
    await page.evaluate(async () => {
      const step = window.innerHeight * 0.8;
      const max = document.documentElement.scrollHeight;
      for (let y = 0; y < max; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 80));
      }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 200));
    });

    await page.screenshot({
      path: resolve(OUT_DIR, `${spec.label}.${vp.label}.png`),
      fullPage: true,
    });

    // Axe only against desktop to keep the run fast — the violation
    // set is the same regardless of viewport.
    if (vp.label === "desktop") {
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      result.violations = axe.violations.map((v) => ({
        id: v.id,
        impact: v.impact ?? undefined,
        description: v.description,
        nodes: v.nodes.length,
        helpUrl: v.helpUrl,
      }));
    }
  } catch (err) {
    result.status = "error";
    result.errorMessage = err instanceof Error ? err.message : String(err);
  } finally {
    await ctx.close();
  }

  return result;
}

async function main() {
  if (!existsSync(CHROMIUM_PATH)) {
    throw new Error(`Chromium binary not found at ${CHROMIUM_PATH}`);
  }
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ["--no-sandbox"],
  });

  const results: ScanResult[] = [];
  for (const spec of PAGES) {
    for (const vp of VIEWPORTS) {
      process.stdout.write(`${spec.label} @ ${vp.label} … `);
      const r = await scanPage(browser, spec, vp);
      results.push(r);
      console.log(
        r.status === "ok"
          ? `ok  (${r.violations.length} a11y)`
          : `ERROR  ${r.errorMessage ?? ""}`,
      );
    }
  }

  await browser.close();

  await writeFile(resolve(OUT_DIR, "report.json"), JSON.stringify(results, null, 2));

  // Stdout summary — easier to scan than the JSON.
  const violationsByRule = new Map<string, { count: number; impact: string | undefined; helpUrl: string; sample: string }>();
  let totalViolations = 0;
  let pageErrors = 0;
  for (const r of results) {
    if (r.status === "error") pageErrors++;
    for (const v of r.violations) {
      totalViolations += v.nodes;
      const prev = violationsByRule.get(v.id);
      violationsByRule.set(v.id, {
        count: (prev?.count ?? 0) + v.nodes,
        impact: v.impact,
        helpUrl: v.helpUrl,
        sample: prev?.sample ?? v.description,
      });
    }
  }

  console.log("");
  console.log(`--- summary ---`);
  console.log(`scans: ${results.length}    page-errors: ${pageErrors}`);
  console.log(`a11y violations (total nodes): ${totalViolations}`);
  if (violationsByRule.size > 0) {
    console.log("");
    const sorted = [...violationsByRule.entries()].sort(
      (a, b) => b[1].count - a[1].count,
    );
    for (const [id, v] of sorted) {
      console.log(`  [${v.impact ?? "?"}] ${id} — ${v.count} nodes`);
      console.log(`        ${v.sample.slice(0, 110)}`);
    }
  }
  console.log("");
  console.log(`screenshots + report.json in ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
