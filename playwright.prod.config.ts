import { defineConfig, devices } from "@playwright/test";

/**
 * Production-smoke Playwright config — separate from the local smoke
 * (playwright.config.ts) so we never spin up a webServer or pull in
 * the local-only dummy env. BASE_URL must point at a real deployment
 * (production or preview).
 *
 * Run via `pnpm smoke:e2e`. CI calls it from .github/workflows/
 * smoke-after-deploy.yml after the HTTP smoke (`pnpm smoke`) passes.
 */
const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) {
  // Fail fast — running this config without a target is always a mistake.
  throw new Error(
    "playwright.prod.config: BASE_URL is required. Set it to the deployment URL you want to smoke.",
  );
}

export default defineConfig({
  testDir: "./tests/prod-smoke",
  // No fullyParallel — each test submits a real DB row (flagged [SMOKE]
  // so it doesn't pollute, but still). Sequential keeps the audit log
  // readable and lets the rate-limiter breathe.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // For Vercel-Auth-gated previews. Bypass header forwarded by the
    // CI workflow when VERCEL_AUTOMATION_BYPASS_SECRET is set.
    extraHTTPHeaders: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? {
          "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
          "x-vercel-set-bypass-cookie": "true",
        }
      : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
