import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ?? "3000";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

// Smoke suite is intentionally narrow — fast UI sanity for the public
// surfaces that block a deploy. DB-touching paths (quote submit, sign-in)
// are exercised against a dev server with dummy Supabase env, so the
// network calls fail closed; tests verify the UI handles that gracefully.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: "pnpm start",
        url: BASE_URL,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
        env: {
          // Dummy values let the server boot without contacting Supabase.
          // Routes that would call into DB return safe fallbacks or 500s,
          // which the smoke suite tolerates rather than asserts on.
          NEXT_PUBLIC_SUPABASE_URL:
            process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co",
          NEXT_PUBLIC_SUPABASE_ANON_KEY:
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "ci-placeholder",
          SUPABASE_SERVICE_ROLE_KEY:
            process.env.SUPABASE_SERVICE_ROLE_KEY ?? "ci-placeholder",
          DATABASE_URL:
            process.env.DATABASE_URL ?? "postgresql://ci:ci@localhost:5432/ci",
          DIRECT_URL:
            process.env.DIRECT_URL ?? "postgresql://ci:ci@localhost:5432/ci",
        },
      },
});
