/* eslint-disable no-console */
/**
 * Deep-dive into color-contrast violations: dump selector + computed
 * fg/bg colors per failing node, then aggregate by (fg, bg) pair so
 * we can pick the smallest set of token bumps with biggest impact.
 */
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const CHROMIUM_PATH = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.AUDIT_BASE_URL ?? "http://localhost:3000";

const PAGES = [
  "/",
  "/aircraft",
  "/aircraft/midsize",
  "/memberships",
  "/how-it-works",
  "/safety",
  "/about",
  "/contact",
  "/empty-legs",
  "/faq",
  "/quote/mission",
  "/sign-in",
];

type PairAgg = {
  fg: string;
  bg: string;
  ratio: number;
  count: number;
  pages: Set<string>;
  samples: string[]; // up to 3 selector samples
};

async function main() {
  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ["--no-sandbox"],
  });

  const pairs = new Map<string, PairAgg>();

  for (const path of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    try {
      const resp = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 30_000 });
      if (!resp || resp.status() >= 400) {
        console.log(`SKIP ${path} (${resp?.status()})`);
        await ctx.close();
        continue;
      }
      // Trigger reveals.
      await page.evaluate(async () => {
        const step = window.innerHeight * 0.8;
        const max = document.documentElement.scrollHeight;
        for (let y = 0; y < max; y += step) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 60));
        }
        window.scrollTo(0, 0);
        await new Promise((r) => setTimeout(r, 200));
      });

      const axe = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
      for (const v of axe.violations) {
        for (const n of v.nodes) {
          // axe stuffs fg/bg/ratio into `any` parameters on the
          // color-contrast check; extract them.
          const colorCheck = n.any.find((c) => c.id === "color-contrast");
          if (!colorCheck) continue;
          const d = colorCheck.data as
            | {
                fgColor?: string;
                bgColor?: string;
                contrastRatio?: number;
              }
            | undefined;
          const fg = d?.fgColor ?? "?";
          const bg = d?.bgColor ?? "?";
          const ratio = d?.contrastRatio ?? 0;
          const key = `${fg}|${bg}`;
          const existing = pairs.get(key);
          if (existing) {
            existing.count++;
            existing.pages.add(path);
            if (existing.samples.length < 3) existing.samples.push(n.target.join(" "));
          } else {
            pairs.set(key, {
              fg,
              bg,
              ratio,
              count: 1,
              pages: new Set([path]),
              samples: [n.target.join(" ")],
            });
          }
        }
      }
    } catch (err) {
      console.log(`ERR ${path}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      await ctx.close();
    }
  }

  await browser.close();

  // Sort by count descending — biggest wins first.
  const sorted = [...pairs.values()].sort((a, b) => b.count - a.count);

  console.log("");
  console.log("─".repeat(80));
  console.log(
    `${sorted.length} distinct (fg, bg) pairs failing color-contrast across ${PAGES.length} pages`,
  );
  console.log(`total failing nodes: ${sorted.reduce((s, p) => s + p.count, 0)}`);
  console.log("");
  for (const p of sorted) {
    console.log(
      `  fg ${p.fg.padEnd(22)} on bg ${p.bg.padEnd(22)}  ratio ${p.ratio.toFixed(2)}  ${p.count} nodes across ${p.pages.size} pages`,
    );
    for (const s of p.samples.slice(0, 2)) {
      console.log(`        sample: ${s.slice(0, 100)}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
