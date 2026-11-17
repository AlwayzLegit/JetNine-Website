import { test, expect } from "@playwright/test";

// The page an emailed link opens (OPS-94). The smoke server has no database,
// so a real token is covered by the unit tests in src/lib/auth-tokens only.
// What is covered here: a junk token shows the expired page, sets no cookie,
// and the page tells browsers to send no referrer.

const JUNK = "A".repeat(43);

test.describe("emailed link page", () => {
  for (const purpose of ["signin", "reset", "invite"]) {
    test(`a junk ${purpose} token shows "That link has expired" and sets no cookie`, async ({ page, context }) => {
      const res = await page.goto(`/auth/link?t=${JUNK}&p=${purpose}`);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { name: /that link has expired/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /sign in to jetnine|set your password/i })).toHaveCount(0);
      expect(res?.headers()["set-cookie"]).toBeUndefined();
      expect(await context.cookies()).toHaveLength(0);
    });
  }

  test("a missing or malformed token shows the expired page", async ({ page }) => {
    for (const url of ["/auth/link", "/auth/link?t=short&p=signin", `/auth/link?t=${JUNK}&p=admin`, "/auth/link?expired=1"]) {
      const res = await page.goto(url);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { name: /that link has expired/i })).toBeVisible();
    }
  });

  test("the page sends no referrer and is not indexed", async ({ page }) => {
    await page.goto(`/auth/link?t=${JUNK}&p=reset`);
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("the expired page offers a way back", async ({ page }) => {
    await page.goto(`/auth/link?t=${JUNK}&p=signin`);
    await expect(page.getByRole("link", { name: /back to sign in/i })).toHaveAttribute("href", "/sign-in");
    await expect(page.getByRole("link", { name: /reset your password/i })).toHaveAttribute("href", "/sign-in/reset");
  });
});
