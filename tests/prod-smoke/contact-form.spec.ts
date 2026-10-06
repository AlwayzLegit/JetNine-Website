import { test, expect } from "@playwright/test";

/**
 * Production smoke: submits the public contact form against the live
 * deployment. Same [SMOKE] convention as the quote-wizard smoke — the
 * submitContactInquiry action recognizes the firstName prefix, inserts
 * the row pre-handled (status='handled') and skips the dispatch email,
 * so deploy noise never reaches the desk.
 *
 * Selectors follow the light redesign's form: the "New charter" topic
 * (default) with a one-way trip, contact details, then the submit button
 * whose label names the topic. The form maps its inputs onto the action's
 * original field names, so this also proves that mapping end to end.
 */

test.describe("@prod-smoke contact form", () => {
  test.setTimeout(60_000);

  test("submits a [SMOKE] inquiry end-to-end", async ({ page }) => {
    const stamp = Date.now();

    await page.goto("/contact");
    await expect(page.getByRole("heading", { name: /contact jetnine/i }).first()).toBeVisible({
      timeout: 15_000,
    });

    // Surfaces that ship with the live form — assert they rendered so a
    // silent regression doesn't hide behind the submit.
    await expect(page.getByTestId("desk-clock")).toBeVisible();

    const form = page.locator("section#form");
    await form.getByRole("textbox", { name: /^from\b/i }).fill("KVNY");
    await form.getByRole("textbox", { name: /^to\b/i }).fill("KTEB");

    const date = new Date();
    date.setDate(date.getDate() + 21);
    await form.getByLabel(/^departure date/i).fill(date.toISOString().slice(0, 10));
    await form.getByLabel(/^passengers/i).selectOption("2");

    await form.getByLabel(/^first name/i).fill("[SMOKE]");
    await form.getByLabel(/^last name/i).fill(`Contact-${stamp}`);
    await form.getByLabel(/^email/i).fill(`smoke+contact${stamp}@jetnine.com`);
    await form.getByLabel(/^trip notes/i).fill(`[SMOKE] automated post-deploy check · ${stamp}`);

    await form.getByRole("button", { name: /request a charter quote/i }).click();

    const success = page.getByText(/Request received|a person will be in touch shortly/i);
    const errorBanner = page.locator("text=/Not sent|Too many sends|Check —/");

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
