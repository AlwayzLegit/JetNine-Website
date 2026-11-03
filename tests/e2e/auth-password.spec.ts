import { test, expect } from "@playwright/test";

// Runs against the smoke server's dummy Supabase env (example.supabase.co),
// so nothing here sends an email or reaches a real auth project. What is
// covered: the form's own validation, the show/hide toggle, and that a
// request which fails at the network edge degrades to an honest error.

test.describe("password sign-in form", () => {
  test("is the primary form, with the magic link below it", async ({ page }) => {
    await page.goto("/sign-in");
    const form = page.getByTestId("password-form");
    await expect(form.getByLabel(/^email$/i)).toBeVisible();
    await expect(form.getByLabel(/^password$/i)).toBeVisible();
    await expect(form.getByRole("button", { name: /^sign in/i })).toBeVisible();
    await expect(form.getByRole("link", { name: /forgot password/i })).toHaveAttribute("href", "/sign-in/reset");
    // Magic link stays as the secondary option.
    await expect(page.getByRole("button", { name: /email me a link/i })).toBeVisible();
    const magicBox = await page.getByRole("button", { name: /email me a link/i }).boundingBox();
    const signInBox = await form.getByRole("button", { name: /^sign in/i }).boundingBox();
    expect(magicBox!.y).toBeGreaterThan(signInBox!.y);
  });

  test("show/hide toggle flips the field and keeps focus in it", async ({ page }) => {
    await page.goto("/sign-in");
    const form = page.getByTestId("password-form");
    const password = form.getByLabel(/^password$/i);
    const toggle = form.getByRole("button", { name: /show password/i });

    await password.fill("hunter2hunter2");
    await expect(password).toHaveAttribute("type", "password");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");

    await toggle.click();
    await expect(password).toHaveAttribute("type", "text");
    await expect(form.getByRole("button", { name: /hide password/i })).toHaveAttribute("aria-pressed", "true");
    await expect(password).toBeFocused();

    await form.getByRole("button", { name: /hide password/i }).click();
    await expect(password).toHaveAttribute("type", "password");
    await expect(password).toBeFocused();
  });

  test("rejects an empty submit client-side", async ({ page }) => {
    await page.goto("/sign-in");
    const form = page.getByTestId("password-form");
    await form.getByRole("button", { name: /^sign in/i }).click();
    await expect(form.getByRole("alert")).toHaveText(/enter your email and password/i);
  });

  test("rejects a malformed email and a missing password", async ({ page }) => {
    await page.goto("/sign-in");
    const form = page.getByTestId("password-form");
    await form.getByLabel(/^email$/i).fill("not-an-email");
    await form.getByLabel(/^password$/i).fill("whatever123");
    await form.getByRole("button", { name: /^sign in/i }).click();
    await expect(form.getByRole("alert")).toHaveText(/valid email/i);

    await form.getByLabel(/^email$/i).fill("member@example.com");
    await form.getByLabel(/^password$/i).fill("");
    await form.getByRole("button", { name: /^sign in/i }).click();
    await expect(form.getByRole("alert")).toHaveText(/enter your password/i);
  });

  test("a failed sign-in shows an honest error and re-enables the form", async ({ page }) => {
    // Dummy Supabase host: the action's call can't reach an auth server, so
    // the member must see a sentence, never a stuck "Signing in…" button
    // and never a crash page. Whichever sentence comes back must not say
    // whether the address has an account.
    await page.goto("/sign-in");
    const form = page.getByTestId("password-form");
    await form.getByLabel(/^email$/i).fill("member@example.com");
    await form.getByLabel(/^password$/i).fill("not-the-password");
    await form.getByRole("button", { name: /^sign in/i }).click();
    await expect(form.getByRole("alert")).toHaveText(/don't match|couldn't sign in|too many/i, { timeout: 20_000 });
    await expect(form.getByRole("alert")).not.toHaveText(/no account|not found|unknown/i);
    await expect(form.getByRole("button", { name: /^sign in/i })).toBeEnabled();
    expect(page.url()).toMatch(/sign-in/);
  });
});

test.describe("password reset request", () => {
  test("page renders with an email field", async ({ page }) => {
    const response = await page.goto("/sign-in/reset");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/forgot it/i);
    await expect(page.getByLabel(/^email$/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /back to sign in/i })).toHaveAttribute("href", "/sign-in");
  });

  test("rejects a malformed email", async ({ page }) => {
    await page.goto("/sign-in/reset");
    const form = page.getByTestId("reset-request-form");
    await form.getByLabel(/^email$/i).fill("nope");
    await form.getByRole("button", { name: /email me a reset link/i }).click();
    // Scoped to the form: Next's route announcer is also role="alert".
    await expect(form.getByRole("alert")).toHaveText(/valid email/i, { timeout: 20_000 });
  });

  test("a well-formed email gets a neutral sentence or an honest failure", async ({ page }) => {
    // No real email is sent: the dummy auth host refuses the request. The
    // reply must be either the neutral "if that email has an account" line
    // or a plain "couldn't send" — never a stack trace or a stuck button.
    await page.goto("/sign-in/reset");
    const form = page.getByTestId("reset-request-form");
    await form.getByLabel(/^email$/i).fill("member@example.com");
    await form.getByRole("button", { name: /email me a reset link/i }).click();
    const outcome = form.getByRole("status").or(form.getByRole("alert"));
    await expect(outcome.first()).toHaveText(/if that email has a jetnine account|couldn't send|too many/i, {
      timeout: 20_000,
    });
  });
});

test.describe("set password page", () => {
  test("without a session it says the link expired and offers a new one", async ({ page }) => {
    const response = await page.goto("/auth/reset");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/expired/i);
    await expect(page.getByRole("link", { name: /request a new link/i })).toHaveAttribute("href", "/sign-in/reset");
  });

  test("a stray reset code is forwarded to the callback and comes back here", async ({ request }) => {
    // Supabase sends the member to /auth/reset?code=… ; the middleware must
    // hand the code to /auth/callback with next=/auth/reset, not /account.
    const res = await request.get("/auth/reset?code=abc123", { maxRedirects: 0 });
    expect(res.status()).toBeGreaterThanOrEqual(300);
    expect(res.status()).toBeLessThan(400);
    const location = res.headers()["location"] ?? "";
    expect(location).toContain("/auth/callback");
    expect(location).toContain("code=abc123");
    expect(location).toContain("next=%2Fauth%2Freset");
  });

  test("account security page is gated", async ({ page }) => {
    await page.goto("/account/security");
    expect(page.url()).toMatch(/sign-in/);
  });
});
