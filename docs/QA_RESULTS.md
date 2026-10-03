# QA results

## 2026-10-03 — automated half (build of `main` at 7f6673b)

Ran on a local production build with no database, so DB-backed sections
degrade or redirect to sign-in by design; a 500 anywhere would be a bug.
Raw outputs: launch audit, SEO snapshots and diffs, a11y scans, crawl,
quote-flow screenshots and console logs are kept in the session scratchpad
(`qa/`).

### Result: no blocking defects

| Check | Result |
|---|---|
| Launch audit (117 pages × 390/1440 px) | 0 load errors, 0 horizontal overflow, 0 controls under 24 px, 0 axe WCAG 2.1 A/AA violations |
| SEO snapshot vs post-redesign (`seo-final.json`) | identical |
| SEO snapshot vs pre-redesign baseline | 0 paths missing or added; 0 status, title, canonical or robots changes; description and JSON-LD diffs are copy edits only ("NM" → "nm", "airframes" → "aircraft", "sectors" → "legs"); robots.txt gained AI-bot blocks |
| Mobile a11y (12 pages × 2 viewports) | 0 page errors, 0 axe violations |
| Crawl (121 URLs: sitemap + extras) | 114 × 200, 2 × 307 (admin/account → sign-in), 1 × 308 (/quote → /quote/mission), 2 × 401 (API without a key), 2 × 404 (bad request token; `/health`, which doesn't exist — the endpoint is `/api/health`). 0 × 5xx, 0 error boundaries, no missing or duplicate titles |
| Quote flow (390 and 1280 px) | all four steps work; validation messages in plain words; submit without a DB fails cleanly inline ("Not sent (DB_INSERT_FAILED). Try again, or call dispatch."), no crash |
| Browser console (6 pages × 2 viewports) | 0 errors apart from the local-only HTTPS upgrade noise below |
| Production runtime errors, last 7 days | only external unsigned probes of the Stripe webhook (400 by design) and the known Satori webp issue on social images |
| Database integrity | 0 quotes without legs; 0 quotes converted to a missing trip; 0 open requests past their reply deadline; 0 live empty legs already departed |
| API | 0 working keys, 0 logged calls (nothing has used it yet) |
| Email delivery (Resend, last 40) | JetNine's only recent send (a sign-in link) delivered; the account is shared with other businesses, whose mail dominates the log |

### Low-severity notes (not fixed)

1. **HSTS and `upgrade-insecure-requests` are sent on plain HTTP.** Only
   matters on a local `http://` build, where Next's prefetch of `/account`
   is upgraded to `https://localhost` and logs a console error before
   falling back. Harmless in production. Could be gated to production.
2. **Some links are 24–43 px wide at 390 px** (header logo, short footer
   links, the trip-type segmented buttons). They pass the 24 px minimum;
   heights are 44 px. Cosmetic.
3. **149 smoke-test quotes in the database.** Every post-deploy smoke run
   adds rows named `[SMOKE]…`. They are hidden from the desk and reports
   but never deleted. Suggest pruning rows older than 7 days from the
   daily maintenance cron.

### Not covered here

Everything behind sign-in (admin desk, member account), real email and
text delivery, Stripe, and the API with a live key. Those are the
signed-in half in `QA_E2E.md`. Twilio delivery logs aren't reachable from
the cloud session; texts are confirmed on the phone or skipped.
