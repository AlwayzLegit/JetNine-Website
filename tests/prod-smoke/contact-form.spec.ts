import { test, expect } from "@playwright/test";

/**
 * Production smoke: submits the public contact form against the live
 * deployment. Same [SMOKE] convention as the quote-wizard smoke — the
 * submitContactInquiry action recognizes the firstName prefix, inserts
 * the row pre-handled (status='handled') and skips the dispatch email,
 * so deploy noise never reaches the desk.
 */

test.describe("@prod-smoke contact form", () => {
  test.setTimeout(60_000);

  test("submits a [SMOKE] inquiry end-to-end", async ({ page }) => {
    const stamp = Date.now();

    await page.goto("/contact");
    await expect(
      page.getByRole("heading", { name: /one desk/i }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // New contact-page surfaces ship together with the live form — assert
    // they rendered so a silent regression doesn't hide behind the submit.
    await expect(page.getByTestId("kvny-map")).toBeVisible();
    await expect(page.getByTestId("desk-clock")).toBeVisible();

    await page.getByLabel(/first name/i).fill("[SMOKE]");
    await page.getByLabel(/last name/i).fill(`Contact-${stamp}`);
    await page.getByLabel(/^email$/i).fill(`smoke+contact${stamp}@jetnine.com`);
    await page.getByLabel(/departing/i).fill("KVNY");
    await page.getByLabel(/arriving/i).fill("KTEB");
    await page.getByLabel(/date \/ window/i).fill("next week · flexible");
    await page.getByLabel(/passengers/i).fill("2");
    await page
      .getByLabel(/anything else/i)
      .fill(`[SMOKE] automated post-deploy check · ${stamp}`);

    await page.getByRole("button", { name: /send to dispatch/i }).click();

    const success = page.getByText(/CLEARED — DISPATCH WILL REPLY/i);
    const errorBanner = page.locator("text=/NOT SENT|TOO MANY SENDS|CHECK —/");

    await expect(async () => {
      const found = (await success.count()) + (await errorBanner.count());
      expect(found).toBeGreaterThan(0);
    }).toPass({ timeout: 30_000 });

    if ((await errorBanner.count()) > 0) {
      const errText = await errorBanner.first().textContent();
      throw new Error(`Contact form returned error: ${errText}`);
    }

    console.log(`[prod-smoke] contact inquiry submitted (stamp ${stamp})`);
  });
});
