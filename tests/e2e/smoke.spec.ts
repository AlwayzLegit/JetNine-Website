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
    await expect(page.getByText(/Let the right route find you/i).first()).toBeVisible();
  });
});

test.describe("contact page", () => {
  test("renders the live desk clock", async ({ page }) => {
    const response = await page.goto("/contact");
    expect(response?.status()).toBe(200);
    await expect(page.getByTestId("desk-clock")).toBeVisible();
    // Clock ticks after hydration: a real h:mm in Los Angeles replaces
    // the SSR placeholder within a tick or two.
    await expect(page.getByTestId("desk-clock")).toContainText(
      /\d{1,2}:\d{2} (AM|PM) in Los Angeles/,
      { timeout: 10_000 },
    );
  });

  test("contact form rejects an empty submit client-side", async ({ page }) => {
    await page.goto("/contact");
    await page.locator("section#form").getByRole("button", { name: /request a charter quote/i }).click();
    await expect(page.getByText(/Check —/)).toBeVisible();
  });

  test("card inquiry does not require trip fields", async ({ page }) => {
    // Trip fields are quote-only. With the local dummy DATABASE_URL the
    // insert fails, so "Not sent" here proves validation PASSED
    // without from/to/date — the regression this guards is the form
    // bouncing a Card question with "Check — departing, arriving, date".
    // In the light redesign a card question is the "General question" tab
    // with the "Programs and cards" subject (sent as reason=card).
    await page.goto("/contact");
    const form = page.locator("section#form");
    await form.getByRole("tab", { name: /general question/i }).click();
    await form.getByLabel(/^subject/i).selectOption("Programs and cards");
    await form.getByLabel(/^first name/i).fill("Smoke");
    await form.getByLabel(/^last name/i).fill("CardAsk");
    await form.getByLabel(/^email/i).fill("smoke@example.com");
    await form.getByRole("button", { name: /send message/i }).click();
    await expect(page.getByText(/Not sent\./)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("contact form degrades gracefully when the DB is down", async ({ page }) => {
    // The local smoke server runs with a dummy DATABASE_URL, so the
    // Server Action's insert fails. Contract: the visitor sees an honest
    // error — never a fake success, never a crash page.
    await page.goto("/contact");
    const form = page.locator("section#form");
    await form.getByRole("textbox", { name: /^from\b/i }).fill("KVNY");
    await form.getByRole("textbox", { name: /^to\b/i }).fill("KTEB");
    const date = new Date();
    date.setDate(date.getDate() + 21);
    await form.getByLabel(/^departure date/i).fill(date.toISOString().slice(0, 10));
    await form.getByLabel(/^passengers/i).selectOption("2");
    await form.getByLabel(/^first name/i).fill("Smoke");
    await form.getByLabel(/^last name/i).fill("Local");
    await form.getByLabel(/^email/i).fill("smoke@example.com");
    await form.getByRole("button", { name: /request a charter quote/i }).click();
    await expect(page.getByText(/Not sent\./)).toBeVisible({
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

test.describe("request status page", () => {
  test("malformed token is a 404", async ({ page }) => {
    const response = await page.goto("/request/not-a-token");
    expect(response?.status()).toBe(404);
    await expect(page.getByText(/can[’']t find that request/i)).toBeVisible();
  });

  test("well-formed token degrades gracefully without a DB", async ({ page }) => {
    // Dummy DATABASE_URL: the lookup throws, the page must hold rather
    // than 500 — the link in the acknowledgment email keeps working.
    const response = await page.goto(`/request/${"a".repeat(48)}`);
    expect(response?.status()).toBeLessThan(500);
    await expect(page.getByText(/can[’']t load this right now|can[’']t find that request/i)).toBeVisible();
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

  test("old desk URLs redirect into the five-section desk, then to sign-in", async ({ request }) => {
    // Redesign phase 5 collapsed the admin to five sections. Old links live
    // in dispatch emails, so they must keep resolving (next.config redirects)
    // before the sign-in gate takes over.
    const cases: [string, string][] = [
      ["/admin/dispatch", "/admin/requests"],
      ["/admin/quote/abc", "/admin/requests/abc"],
      ["/admin/trip/abc", "/admin/trips/abc"],
      ["/admin/member", "/admin/clients"],
      ["/admin/health", "/admin/settings/connections"],
    ];
    for (const [from, to] of cases) {
      const res = await request.get(from, { maxRedirects: 0 });
      expect(res.status(), from).toBeGreaterThanOrEqual(300);
      expect(res.status(), from).toBeLessThan(400);
      expect(res.headers()["location"], from).toContain(to);
    }
  });

  test("desk sections redirect to sign-in when signed out", async ({ page }) => {
    for (const path of ["/admin", "/admin/requests", "/admin/messages", "/admin/messages?tab=approvals", "/admin/settings", "/admin/settings/api-keys", "/admin/settings/assistant"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBeLessThan(500);
      expect(page.url(), path).toMatch(/sign-in/);
    }
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

test.describe("api v1", () => {
  // No database in CI: these cover everything decided before a key lookup.
  test("rejects a call without a key with the error envelope", async ({ request }) => {
    const response = await request.get("/api/v1/me");
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toMatchObject({ ok: false, error: { code: "unauthorized" } });
    expect(response.headers()["x-request-id"]).toBeTruthy();
    expect(response.headers()["cache-control"]).toContain("no-store");
  });

  test("rejects a malformed key before touching the database", async ({ request }) => {
    const response = await request.get("/api/v1/me", { headers: { Authorization: "Bearer jn_live_short" } });
    expect(response.status()).toBe(401);
  });

  test("openapi.json needs a key", async ({ request }) => {
    const response = await request.get("/api/v1/openapi.json");
    expect(response.status()).toBe(401);
  });

  test("read endpoints are refused without a key", async ({ request }) => {
    for (const path of ["/api/v1/desk/snapshot", "/api/v1/requests", "/api/v1/clients", "/api/v1/history", "/api/v1/reports/summary", "/api/v1/agent/context"]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(401);
      expect((await response.json()).error?.code, path).toBe("unauthorized");
    }
  });

  test("writes are refused without a key", async ({ request }) => {
    // Many routes, each compiled on first hit by the production server.
    test.slow();
    const id = "00000000-0000-4000-8000-000000000000";
    for (const path of [
      "/api/v1/blog/posts",
      `/api/v1/requests/${id}/status`,
      `/api/v1/requests/${id}/messages`,
      `/api/v1/requests/${id}/send-options`,
      `/api/v1/trips/${id}/messages`,
      `/api/v1/requests/${id}/holds`,
      `/api/v1/requests/${id}/options`,
      `/api/v1/trips/${id}/status`,
      `/api/v1/messages/${id}/retry`,
      "/api/v1/empty-legs",
      "/api/v1/schedule/blocks",
      "/api/v1/reference/operators",
      "/api/v1/reference/airports",
      `/api/v1/requests/${id}/convert`,
      `/api/v1/clients/${id}/ledger`,
      "/api/v1/clients",
      "/api/v1/team",
      "/api/v1/settings/test-email",
    ]) {
      const response = await request.post(path, { data: { title: "x" } });
      expect(response.status(), path).toBe(401);
      expect((await response.json()).error?.code, path).toBe("unauthorized");
    }
  });

  test("reference and assignment changes are refused without a key", async ({ request }) => {
    // Each route compiles on first hit by the production server, like the test above.
    test.slow();
    const id = "00000000-0000-4000-8000-000000000000";
    for (const path of [
      `/api/v1/requests/${id}/assignee`,
      `/api/v1/requests/${id}/client`,
      `/api/v1/reference/aircraft/${id}`,
      `/api/v1/invoices/${id}`,
      "/api/v1/settings/desk",
      `/api/v1/team/${id}`,
    ]) {
      const response = await request.patch(path, { data: {} });
      expect(response.status(), path).toBe(401);
    }
    for (const path of [`/api/v1/reference/airports/${id}`, `/api/v1/team/${id}`]) {
      const del = await request.delete(path);
      expect(del.status(), path).toBe(401);
    }
  });

  test("the approval queue needs a key", async ({ request }) => {
    const response = await request.get("/api/v1/approvals");
    expect(response.status()).toBe(401);
  });

  test("sends no CORS headers", async ({ request }) => {
    const response = await request.fetch("/api/v1/me", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "GET" },
    });
    expect(response.headers()["access-control-allow-origin"]).toBeUndefined();
  });

  test("legacy blog API refuses an unknown key and points at v1", async ({ request }) => {
    const response = await request.get("/api/admin/blog", { headers: { Authorization: "Bearer not-a-key" } });
    expect(response.status()).toBe(401);
    expect(await response.json()).toMatchObject({ ok: false, error: "Unauthorized." });
    expect(response.headers()["deprecation"]).toBe("true");
    expect(response.headers()["link"]).toContain("/api/v1/blog/posts");
  });
});
