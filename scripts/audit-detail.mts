/* eslint-disable no-console */
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const CHROMIUM_PATH = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.AUDIT_BASE_URL ?? "http://localhost:3000";

const TARGETS = [
  { url: "/", rules: ["aria-required-children"] },
  { url: "/quote/mission", rules: ["label"] },
  { url: "/empty-legs", rules: ["link-in-text-block"] },
];

async function main() {
  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ["--no-sandbox"],
  });

  for (const t of TARGETS) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}${t.url}`, { waitUntil: "networkidle" });

    const axe = await new AxeBuilder({ page }).withRules(t.rules).analyze();
    console.log(`\n=== ${t.url} ===`);
    for (const v of axe.violations) {
      console.log(`[${v.impact}] ${v.id} — ${v.description}`);
      for (const n of v.nodes) {
        console.log(`  selector: ${n.target.join(" ")}`);
        console.log(`  html:     ${n.html.slice(0, 200).replace(/\s+/g, " ")}`);
        console.log(`  failure:  ${n.failureSummary?.slice(0, 200) ?? ""}`);
      }
    }
    await ctx.close();
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
