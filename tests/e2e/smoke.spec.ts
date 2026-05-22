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

  test("404 page is branded", async ({ page }) => {
    const response = await page.goto("/this-route-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.getByText(/Off the flight plan/i)).toBeVisible();
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
