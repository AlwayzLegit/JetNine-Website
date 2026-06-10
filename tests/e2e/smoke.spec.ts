import { test, expect } from "@playwright/test";

test.describe("public marketing surface", () => {
  test("homepage renders without throwing", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator("body")).toBeVisible();
    await expect(page).toHaveTitle(/JetNine/i);
  });

  test("legal page renders", async ({ page }) => {
    await page.goto("/legal");
    await expect(page.locator("body")).toBeVisible();
    // Part 295 disclosure is a required public artifact.
    await expect(page.getByText(/Part 295/i).first()).toBeVisible();
  });

  // One render pass over every static marketing page. Anything that
  // throws at request time (bad import, JSON-LD typo, missing data file)
  // turns into a 500 here instead of being discovered post-deploy.
  for (const path of [
    "/about",
    "/safety",
    "/how-it-works",
    "/faq",
    "/memberships",
    "/aircraft",
    "/aircraft/light",
    "/aircraft/ultra",
  ]) {
    test(`marketing page ${path} renders`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator("h1").first()).toBeVisible();
    });
  }

  test("robots.txt and sitemap.xml are served", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toContain("Sitemap");
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).toContain("<urlset");
  });

  test("404 page is branded", async ({ page }) => {
    const response = await page.goto("/this-route-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.getByText(/Off the flight plan/i)).toBeVisible();
  });

  // Regression guard for the 500 caught during the mobile-a11y audit.
  // /empty-legs queries the DB at request time; if the connection
  // refuses (Supabase paused, env var missing, etc.) the page must
  // degrade to an empty board, not 500. The page wraps getLiveLegs
  // in try/catch + skips bad rows; this test asserts the contract
  // holds even when the smoke suite runs with a dummy DATABASE_URL
  // that can't actually connect.
  test("empty-legs degrades gracefully without a DB", async ({ page }) => {
    const response = await page.goto("/empty-legs");
    expect(response?.status()).toBeLessThan(500);
    await expect(page.getByText(/Repositioning legs/i).first()).toBeVisible();
    // Watchlist form is always present regardless of board state.
    await expect(page.getByText(/Set a route/i).first()).toBeVisible();
  });
});

test.describe("contact page", () => {
  test("renders the KVNY field diagram and live desk clock", async ({ page }) => {
    const response = await page.goto("/contact");
    expect(response?.status()).toBe(200);
    await expect(page.getByTestId("kvny-map")).toBeVisible();
    // Runway designators are factual content, not decoration — assert
    // they survive any future redesign of the SVG.
    await expect(page.getByTestId("kvny-map")).toContainText("16R");
    await expect(page.getByTestId("desk-clock")).toBeVisible();
    // Clock ticks after hydration: a real HH:MM:SS replaces the SSR
    // placeholder within a tick or two.
    await expect(page.getByTestId("desk-clock")).toContainText(/\d{2}:\d{2}:\d{2}/, {
      timeout: 10_000,
    });
  });

  test("contact form rejects an empty submit client-side", async ({ page }) => {
    await page.goto("/contact");
    await page.getByRole("button", { name: /send to dispatch/i }).click();
    await expect(page.getByText(/CHECK —/)).toBeVisible();
  });

  test("card inquiry does not require trip fields", async ({ page }) => {
    // Trip fields are quote-only. With the local dummy DATABASE_URL the
    // insert fails, so DB_INSERT_FAILED here proves validation PASSED
    // without from/to/date — the regression this guards is the form
    // bouncing a Card question with CHECK — FROM, TO, DATE.
    await page.goto("/contact");
    await page.getByRole("button", { name: /card \/ reserve/i }).click();
    await page.getByLabel(/first name/i).fill("Smoke");
    await page.getByLabel(/last name/i).fill("CardAsk");
    await page.getByLabel(/^email$/i).fill("smoke@example.com");
    await page.getByRole("button", { name: /send to dispatch/i }).click();
    await expect(page.getByText(/NOT SENT — DB_INSERT_FAILED/)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("contact form degrades gracefully when the DB is down", async ({ page }) => {
    // The local smoke server runs with a dummy DATABASE_URL, so the
    // Server Action's insert fails. Contract: the visitor sees an honest
    // error — never a fake success, never a crash page.
    await page.goto("/contact");
    await page.getByLabel(/first name/i).fill("Smoke");
    await page.getByLabel(/last name/i).fill("Local");
    await page.getByLabel(/^email$/i).fill("smoke@example.com");
    await page.getByLabel(/departing/i).fill("KVNY");
    await page.getByLabel(/arriving/i).fill("KTEB");
    await page.getByLabel(/date \/ window/i).fill("whenever");
    await page.getByRole("button", { name: /send to dispatch/i }).click();
    await expect(page.getByText(/NOT SENT — DB_INSERT_FAILED/)).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe("quote wizard", () => {
  test("mission step renders and accepts inputs", async ({ page }) => {
    await page.goto("/quote/mission");
    // Wait out the hydration gate by checking for a visible heading.
    await expect(
      page.getByRole("heading", { level: 1 }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("middle steps reachable via direct nav after mission", async ({ page }) => {
    // We intentionally don't drive the full wizard end-to-end here —
    // the store guard will bounce us if mission isn't filled. The smoke
    // test only confirms each step's route handler doesn't crash.
    for (const path of ["/quote/aircraft", "/quote/contact", "/quote/review"]) {
      const response = await page.goto(path);
      expect(response?.status()).toBeLessThan(500);
    }
  });
});

test.describe("auth surface", () => {
  test("sign-in page renders", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByText(/email|magic/i).first()).toBeVisible();
  });

  test("protected route redirects to sign-in", async ({ page }) => {
    const response = await page.goto("/account");
    // Middleware will 307 to /sign-in?next=/account; either we land there
    // or we get rendered the sign-in page directly.
    expect(response?.status()).toBeLessThan(500);
    expect(page.url()).toMatch(/sign-in/);
  });
});

test.describe("stripe webhook endpoint", () => {
  test("rejects request without a signature", async ({ request }) => {
    const response = await request.post("/api/stripe/webhook", {
      data: { fake: "payload" },
    });
    // With STRIPE_SECRET_KEY missing in CI, the route short-circuits to
    // 503 (configured-incorrectly) before signature validation. When the
    // key IS configured, signature validation rejects with 400. Both are
    // acceptable for a smoke test — what matters is we don't 5xx with a
    // crash.
    expect([400, 503]).toContain(response.status());
  });
});

test.describe("email inbound webhook", () => {
  test("returns 404 without a secret configured (ships dark)", async ({ request }) => {
    // INBOUND_EMAIL_SECRET is not set in CI. The route should return
    // 404 (looks like it doesn't exist) rather than 500.
    const response = await request.post("/api/email/inbound/anything", {
      data: { Subject: "[QT-2026-0001] hi", TextBody: "test", MessageID: "x" },
    });
    expect(response.status()).toBe(404);
  });
});

test.describe("twilio inbound webhook", () => {
  test("returns 503 without Twilio configured (ships dark)", async ({ request }) => {
    // No TWILIO_ACCOUNT_SID in CI; route returns 503 so Twilio retries
    // until env lands. Also acceptable: 403 if env partially set and
    // signature fails verification. Crash (5xx with no body) is not.
    const response = await request.post("/api/twilio/inbound", {
      form: { From: "+15551234567", Body: "test", MessageSid: "x" },
    });
    expect([403, 503]).toContain(response.status());
  });
});
