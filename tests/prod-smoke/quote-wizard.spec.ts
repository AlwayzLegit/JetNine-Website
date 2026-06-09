import { test, expect, type Page } from "@playwright/test";

/**
 * Production smoke: walks the quote wizard end-to-end against the live
 * deployed URL and submits. Catches regressions the HTTP smoke can't:
 *
 *   - Zustand store persistence between wizard steps
 *   - Airport autocomplete + the airports lib that backs it
 *   - Date / time picker behavior in real browsers
 *   - Server Action runtime (not just the route existing)
 *   - DB write under the anon Supabase context
 *   - Rate limiter not blocking the smoke runner
 *
 * Submissions are flagged [SMOKE] in firstName; the submitQuote action
 * recognizes the prefix and inserts the row at status='cancelled'
 * with no ack / dispatch email — so smoke noise doesn't reach the
 * inbox or count against SLA. The DB row is still there for forensics.
 *
 * Run against any base URL via Playwright's webServer / baseURL config.
 * BASE_URL=https://jet-nine-website.vercel.app pnpm smoke:e2e
 */

test.describe("@prod-smoke quote wizard", () => {
  test.setTimeout(120_000); // wizard walk is long; CDN cold-start can add seconds

  test("submits a [SMOKE] quote end-to-end", async ({ page }) => {
    const stamp = Date.now();

    // ─── Mission ─────────────────────────────────────────────────────────
    await page.goto("/quote/mission");
    // The h1 reads "Where, when, how many." — match on the heading role
    // so minor copy tweaks don't break the smoke again.
    await expect(page.getByRole("heading", { name: /where/i }).first()).toBeVisible({
      timeout: 15_000,
    });

    // Trip type — pick One-way (matches the .id "oneway" pattern).
    await page.getByRole("button", { name: /one[-\s]?way/i }).first().click();

    await pickAirport(page, "From", "KLAX");
    await pickAirport(page, "To", "KJFK");

    // Date: 30 days out (well past any "departing soon" minimum).
    const date = new Date();
    date.setDate(date.getDate() + 30);
    const dateStr = date.toISOString().slice(0, 10);
    await page.locator('input[type="date"]').first().fill(dateStr);

    // Time: noon-ish (server expects HH:MM).
    await page.locator('input[type="time"]').first().fill("12:00");

    // Pax: leave default — the range input is already aria-labeled
    // (PR #8) and the field has +/- buttons. Default of 4 works.

    // Move to next step. The wizard nav uses a button labeled "Continue"
    // or "Next" — match permissively.
    await clickNext(page, /aircraft|continue|next/i);

    // ─── Aircraft ────────────────────────────────────────────────────────
    await page.waitForURL(/\/quote\/aircraft/, { timeout: 15_000 });
    await expect(page.getByText(/category|aircraft/i).first()).toBeVisible();

    // Pick a midsize. The button is the category card itself.
    await page
      .getByRole("button", { name: /midsize/i })
      .first()
      .click();

    await clickNext(page, /contact|continue|next/i);

    // ─── Contact ─────────────────────────────────────────────────────────
    await page.waitForURL(/\/quote\/contact/, { timeout: 15_000 });

    await page.getByLabel(/first name/i).fill(`[SMOKE]`);
    await page.getByLabel(/last name/i).fill(`Test-${stamp}`);
    await page.getByLabel(/^email$/i).fill(`smoke+${stamp}@jetnine.com`);
    // Phone is "Phone" label; the country selector is "Country" + a select.
    await page.getByLabel(/^phone$/i).fill("8005550100"); // 555 line, won't ring

    // Both required consents — click the visible <label> wrappers since
    // the checkboxes are styled and may not be directly clickable.
    const requiredConsents = page.locator('input[type="checkbox"]');
    const checkboxCount = await requiredConsents.count();
    for (let i = 0; i < Math.min(checkboxCount, 2); i++) {
      const cb = requiredConsents.nth(i);
      if (!(await cb.isChecked())) {
        await cb.check({ force: true });
      }
    }

    await clickNext(page, /review|continue|next/i);

    // ─── Review ──────────────────────────────────────────────────────────
    await page.waitForURL(/\/quote\/review/, { timeout: 15_000 });
    await expect(page.getByText(/Send it to dispatch/i)).toBeVisible();

    await page.getByRole("button", { name: /submit quote request/i }).click();

    // Confirmation: the page either renders a thank-you with the quote
    // ref, or shows an error. Either way, assert no NETWORK / 500 leak.
    // Wait for the thank-you OR the error to land.
    const success = page.getByText(/QT-\d{4}-\d+/);
    const errorBanner = page.locator('text=/RATE_LIMITED|NETWORK|MISSING_/');

    await expect(async () => {
      const found = (await success.count()) + (await errorBanner.count());
      expect(found).toBeGreaterThan(0);
    }).toPass({ timeout: 30_000 });

    if ((await errorBanner.count()) > 0) {
      const errText = await errorBanner.first().textContent();
      throw new Error(`Quote submit returned error: ${errText}`);
    }

    const ref = await success.first().textContent();
    console.log(`[prod-smoke] submitted ${ref?.trim()}`);
  });
});

async function pickAirport(page: Page, label: string, code: string): Promise<void> {
  const input = page.getByLabel(label, { exact: true });
  await input.click();
  await input.fill(code);
  // The dropdown shows a <li><button> per match. Click the first.
  const option = page.locator("ul li button").first();
  await expect(option).toBeVisible({ timeout: 5_000 });
  // Use mousedown to match the component's onMouseDown handler — the
  // outer click-outside listener would otherwise close the dropdown
  // before the click fires.
  await option.dispatchEvent("mousedown");
  // Wait for the chip to render (input now shows "City (IATA)") —
  // signals the airport was actually selected.
  await expect(input).not.toHaveValue(code);
}

async function clickNext(page: Page, pattern: RegExp): Promise<void> {
  // Step nav is a Link OR button depending on the step — accept either.
  // Multiple matches on a page (e.g., "Continue" + "← Back to mission")
  // are handled by taking the last match, which is the forward CTA.
  const buttonCta = page.getByRole("button", { name: pattern });
  const linkCta = page.getByRole("link", { name: pattern });
  const all = await Promise.all([buttonCta.count(), linkCta.count()]);
  if (all[0] > 0) {
    await buttonCta.last().click();
  } else if (all[1] > 0) {
    await linkCta.last().click();
  } else {
    throw new Error(`No next-step CTA matching ${pattern} on ${page.url()}`);
  }
}
