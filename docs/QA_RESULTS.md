# QA results

## 2026-10-30 — signed-in half (local build of `main` at 52caa3b)

Production is not reachable from the cloud session and the owner's sign-in
cannot be scripted, so the desk was exercised on a local production build
with a fresh Postgres 16: all 56 migrations applied from scratch, a stub
of Supabase Auth returning one owner session, and a Playwright walk as
that owner. Rows, History lines and screenshots are in the session
scratchpad (`qa/`). Nothing here touched production.

### Result: one wording defect, fixed in this change

| Check | Result |
|---|---|
| Migrations 0001–0055 on an empty database | all apply; 68 airports seeded, KEDC present |
| Every desk page, signed in as the owner (27 routes, desktop; 7 also at 390 px) | all 200 with the expected heading; 0 console errors; 0 horizontal overflow; nothing under the phone tab bar |
| Settings › Social links | handle, full link and a tracking-tagged link all normalise to the profile URL; a link on the wrong domain is refused with a plain message; footer icons and the Organization `sameAs` update on the next public page load |
| Settings › Voice agent › Agents | create → edit model and greeting → save as version 2 → make live; list shows "Live · Version 2"; a bad model ID is refused; History has created / saved / made live |
| Settings › Voice agent › Routing | ring first, one number, 4 rings, press 1 saves and reloads; a 6-digit number is refused; History: "ring •••0123 for 4 rings (about 24 seconds) (press 1 to accept), then the agent answers" |
| Settings › Notifications | reply promise 30 → 15 → 30, each persisted and reflected in the next request's deadline |
| Quote wizard at 390 px → desk | KVNY → KEDC request lands in "Needs a reply" with a due time; detail page shows the route, extras, Call / Text / Email links; status → Triaged moves it to "Working on it"; History: "marked … as Working on it" |
| Quote safety net | with KEDC deleted from the table, a submission still succeeds and re-creates the row (name, time zone, country) |
| History | every action above reads as a sentence with a resolving link |

### Fixed here

1. **History said "set the reply-time promise to a new value minutes".**
   The sentence reader ignored numeric diff values, so the minutes (and
   the version number in "saved a voice agent") were dropped. It now reads
   "to 15 minutes" and "as version 2".

### Notes (not changed)

1. **"Who is on it" lists dispatchers only.** The assign picker on a
   request shows staff whose role is `dispatcher`; an owner or admin
   without that role cannot take a request from the desk. Expected if
   owners never work requests themselves; otherwise widen the filter.
2. **Status and assignment sit under "Desk tools"**, a collapsed panel
   below the conversation. Deliberate, but two clicks away.
3. Not covered: real email and text delivery, Stripe, invites, the member
   account, and the API with a live key. Those still need the owner's
   browser on the live site (`QA_E2E.md` sections 3.8–3.19, 4).

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
