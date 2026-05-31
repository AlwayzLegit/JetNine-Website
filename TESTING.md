# Testing handoff — JetNine production smoke

You are an autonomous testing agent. This document is your full brief.
The repository is **read-only to you** — you will not commit, push,
merge, modify env vars, modify auth records, or change production data
beyond what a real customer would do (submit a quote, sign in, click
links). You will exercise the production deploy via a real browser and
verify outcomes via MCP queries against Supabase + Vercel.

Read this doc end-to-end before starting. Then execute the test plan in
order. Report findings in the format at the bottom.

---

## What you have

**Tools assumed**:

- **Browser automation MCP** (Playwright, browsermcp, or Computer Use) —
  drives a real browser, can submit forms, click links, take
  screenshots.
- **Supabase MCP** — read postgres rows + auth logs. Project id
  `szuztxfhkudcjzhrkfld`. The `execute_sql` and `get_logs` tools are
  what you'll use most.
- **Vercel MCP** — read deploy state + runtime logs. Project
  `prj_fcimzGWfsLIjGlYvQU3kmipbactr`, team
  `team_di6oiEhCIT17lNXsonHt3mSc`, alias
  `jet-nine-website.vercel.app`.
- **GitHub MCP** — for reading PR diffs, recent commits if you need
  code context. Repo `AlwayzLegit/JetNine-Website`. **Do not write.**
- **Sentry MCP** — likely no relevant data (Sentry not wired yet) but
  available.

**Tools you do NOT have**: Stripe MCP (Phase 4 not wired), Twilio MCP
(Phase 7 not wired), filesystem write for the repo, terminal access to
the prod environment.

## What you must not do

- ❌ Modify code or push to git.
- ❌ Modify Vercel env vars.
- ❌ Modify Supabase auth.users records or run DDL.
- ❌ Run destructive SQL (DELETE / UPDATE on real-customer rows;
  the DB has effectively zero real data right now, but treat it as
  production).
- ❌ Send arbitrary emails through Resend's REST API directly.
- ❌ Submit so many quote-form requests that you trip rate-limiting.
  Five test submissions are plenty.

## Production context (current state at handoff time)

- **Latest production deploy**: most recent `state: READY` deploy on
  the `main` branch. Verify via `list_deployments` MCP call — the top
  entry whose `target` is `"production"` is live.
- **Superadmin**: `alwayzlegit@gmail.com` (already provisioned in
  `auth.users` + `public.users` with `role='superadmin'`,
  `email_verified=true`).
- **Sender domain**: `jetnine.com` verified in Resend. Outbound auth
  + transactional emails go from `JetNine <dispatch@jetnine.com>`.
  `dispatch@` has no inbox — replies route to `anna@jetnine.com`.
- **Dispatch notify recipient**: `anna@jetnine.com` — receives
  new-quote dispatcher alerts and member email replies.

## Phases already verified before this handoff

1. **Phase 1 DB connectivity** — `/api/health` reports `db.ok: true`,
   ~169 ms latency.
2. **Phase 2 first sign-in** — superadmin magic-link auth confirmed
   end-to-end.
3. **PR #11 + #12 pre-launch security pass** — 21 findings fixed
   across the money path, auth, inbound webhooks, race conditions.
   See `LAUNCH.md` for the catalog. Some of these are testable from
   the browser (open-redirect, IDOR on convertQuoteToTrip); the rest
   require Stripe / Twilio wired.
4. **Phase 5 + 6 email** — Supabase Custom SMTP via Resend confirmed
   for magic-link delivery. Branded email templates installed for all
   5 Supabase auth flows (Magic Link, Invite, Confirm signup, Change
   Email, Reset Password).

## Phases NOT yet wired (and therefore out of scope for your testing)

- **Phase 3 Sentry** — org policy blocks project creation. Skip any
  Sentry verification.
- **Phase 4 Stripe** — no `STRIPE_SECRET_KEY` set. `/account/invoices`
  pay button + `/account/memberships` buy button will return
  `STRIPE_NOT_CONFIGURED`. Skip money-path testing entirely.
- **Phase 7 Twilio** — no SMS / WhatsApp send. Skip dispatcher SMS
  channels.
- **Phase 8 Plausible**, **Phase 9 Search Console**, **Phase 10
  Custom domain** — visible-but-cosmetic. Note absence; don't fail
  tests on them.

## Key codebase references (read-only — for understanding behaviour)

- `src/app/(auth)/sign-in/actions.ts` + `src/app/auth/callback/route.ts`
  + `src/lib/safe-next.ts` — magic-link flow + open-redirect guard.
- `src/app/api/health/route.ts` + `src/lib/health.ts` — health probe
  shape.
- `src/app/quote/*` + `src/app/quote/actions.ts` — public quote
  wizard (mission / aircraft / contact / review).
- `src/app/admin/*` — staff-only pages. All actions call
  `requireStaff()`.
- `src/app/account/*` — member-facing pages. Require auth.
- `src/lib/email.ts` — outbound transactional email (quote ack,
  dispatcher alert, trip-status, thread). Provider auto-detect.
- `LAUNCH.md` — current phase status, deferred items.
- PR #11 + #12 commit messages — catalogue every fix applied.

---

## Test plan

Execute these suites in order. Each step has an explicit pass /
fail / blocked criterion you can verify from browser + MCP. Stop and
flag if any **CRITICAL** failure happens — do not continue running
tests against a broken deploy.

### Suite 0 — pre-flight (CRITICAL)

Confirm the deploy is healthy before exercising anything else.

| # | Step | Verify |
|---|---|---|
| 0.1 | Vercel MCP `list_deployments` | Top row `target: "production"` has `state: "READY"` and commit SHA matches `main` HEAD |
| 0.2 | `curl https://jet-nine-website.vercel.app/api/health` (or browser navigation) | HTTP 200, body has `db.ok: true`, `status: "healthy"` or `"degraded"` (not `"unhealthy"`) |
| 0.3 | Vercel `get_runtime_logs` filtered to last 10 min, level=error | Zero errors, OR pre-existing errors not introduced by today's traffic |

If 0.1 or 0.2 fail → **STOP**. Report blocked and exit.

### Suite 1 — public marketing pages

Drive browser to each URL, check the page renders without console
errors and content is present.

| # | URL | Expected |
|---|---|---|
| 1.1 | `/` | Hero loads, no console errors |
| 1.2 | `/how-it-works` | Page renders |
| 1.3 | `/aircraft` | Aircraft category index renders |
| 1.4 | `/aircraft/light` | Category page renders |
| 1.5 | `/memberships` | Card tiers visible |
| 1.6 | `/empty-legs` | At least 1 leg listed (seed data — should be 6) |
| 1.7 | `/faq` | Renders |
| 1.8 | `/safety` | Renders |
| 1.9 | `/legal` | Renders |
| 1.10 | `/contact` | Form renders |
| 1.11 | `/sitemap.xml` | Returns XML with multiple `<loc>` entries |
| 1.12 | `/robots.txt` | Returns valid robots format |

Take a screenshot of `/` for the report.

### Suite 2 — auth flow + open-redirect verification (CRITICAL)

Verifies Phase 2 still passes AND the PR #11 open-redirect fix
holds against four attack vectors.

| # | Step | Expected |
|---|---|---|
| 2.1 | Navigate to `/sign-in` | Form renders with email input + "Email me a link" button |
| 2.2 | Enter `alwayzlegit@gmail.com` → submit | UI shows "Magic link sent to ..." success message; **no** "Couldn't send the link" error |
| 2.3 | Supabase MCP `get_logs` (service: auth) | A `mail.send` event with `mail_from: dispatch@jetnine.com` (or similar), no 550 / 500 errors after submit time |
| 2.4 | Wait ≤60 s, check destination inbox (you'll need access to `alwayzlegit@gmail.com` — or pull the link from auth log if you cannot access the inbox) | Email arrives. Sender `JetNine <dispatch@jetnine.com>`. Subject `— Your JetNine sign-in link`. Branded HTML with `Welcome back.` headline, dark CTA button. |
| 2.5 | Click the magic link → verify redirect | Lands on `/account` while authenticated |
| 2.6 | Supabase MCP `get_logs` (service: auth) | `auth_event.action: "login"` for the actor user |
| 2.7 | **Open-redirect attack** — navigate to `/auth/callback?code=invalidcode&next=https://evil.com` | Redirected to `/sign-in?error=...` (because code is invalid), NOT to evil.com. The `Location` header on the 302 redirect should point to a same-origin path. |
| 2.8 | Same, with `next=//evil.com` | Same as 2.7 — falls back to `/account` or `/sign-in?error=...` |
| 2.9 | Same, with `next=/\evil.com` | Same |
| 2.10 | Same, with `next=javascript:alert(1)` | Same |
| 2.11 | `/sign-in?next=/admin/dispatch` → submit magic-link → click link in email | Lands on `/admin/dispatch` (superadmin can access), NOT `/account` |

If 2.7-2.10 redirect to evil.com or to a `javascript:` URL → **CRITICAL FAIL**, the safeNext fix is broken in prod.

### Suite 3 — admin pages (auth gating)

While signed in as superadmin:

| # | URL | Expected |
|---|---|---|
| 3.1 | `/admin` | Index or dispatcher dashboard renders |
| 3.2 | `/admin/dispatch` | Dispatcher work surface renders |
| 3.3 | `/admin/health` | Probe table renders; DB row green; optional integrations (Stripe, Twilio, Email) show their actual configured state |
| 3.4 | `/admin/quote` | Quote list renders (likely empty, that's fine) |
| 3.5 | `/admin/trip` | Trip list renders |
| 3.6 | `/admin/member` | Member list renders |
| 3.7 | `/admin/ops` | Operations / schedule renders |
| 3.8 | `/admin/audit` | Audit log renders |

In an **unauthenticated** incognito session:

| # | URL | Expected |
|---|---|---|
| 3.9 | `/admin/dispatch` | Redirects to `/sign-in` (or 401/403) |
| 3.10 | `/admin/health` | Same |
| 3.11 | `/account` | Redirects to `/sign-in` |

### Suite 4 — quote submission (Phase 5 outbound email)

The public quote wizard fires two outbound emails: customer ack +
dispatcher alert.

| # | Step | Expected |
|---|---|---|
| 4.1 | Incognito → `/quote` (or `/quote/mission`) | Wizard step 1 loads |
| 4.2 | Mission step: fill route (e.g. KLAX → KSFO), today's date + 1 week, pax=4, one-way | "Next" enables; navigates to `/quote/aircraft` |
| 4.3 | Aircraft step: pick any category | Navigates to `/quote/contact` |
| 4.4 | Contact step: realistic name, **a real email you can read for the customer-side check** (e.g. `qa+jetnine-test@<your-email>.com`), phone in any format | Navigates to `/quote/review` |
| 4.5 | Review step: confirm summary visible, click Submit | Redirect to a success page (probably `/quote/submitted` or back to `/` with a flash) |
| 4.6 | Supabase MCP: `select id, quote_code, status, contact_snapshot from public.quotes order by received_at desc limit 1` | Row inserted with `status='submitted'` and `contact_snapshot.email` matching what you entered. `phoneE164` field should be in canonical E.164 (PR #12 fix). |
| 4.7 | Vercel `get_runtime_logs` last 5 min | Zero errors related to email send. Optionally a `[email]` log line. |
| 4.8 | Check destination inbox for customer ack | Arrives ≤30 s. Sender `JetNine <dispatch@jetnine.com>`. Subject `<QUOTE_CODE> — your JetNine quote request`. HTML renders cleanly (no broken images, no raw `{{ }}` placeholders). Reply-to is `anna@jetnine.com`. |
| 4.9 | Check `anna@jetnine.com` inbox (if you have access) for dispatcher alert | Arrives ≤30 s. Subject prefix `[NEW]`. Body has the workbench URL. |
| 4.10 | Take a screenshot of customer ack email and dispatcher alert email |

If 4.8 fails — customer ack didn't arrive — that's a **CRITICAL** Phase 5
regression.

### Suite 5 — member account pages

While signed in as superadmin:

| # | URL | Expected |
|---|---|---|
| 5.1 | `/account` | Lands; member-facing dashboard |
| 5.2 | `/account/quotes` | Shows quotes attached to this user (likely empty since alwayzlegit isn't bound as a member of any quote) |
| 5.3 | `/account/trips` | Likely empty, renders cleanly |
| 5.4 | `/account/invoices` | Likely empty |
| 5.5 | `/account/memberships` | Tier cards visible; **Buy** button should be disabled or show `Stripe not configured` flash (Phase 4 not wired) |

### Suite 6 — dispatcher actions (PR #11/#12 fix verification)

Open the just-submitted test quote in the workbench and exercise a few
actions. These tests verify the PR #11 IDOR fix and PR #12 channel
allowlist fix.

| # | Step | Expected |
|---|---|---|
| 6.1 | `/admin/quote/<id-from-4.6>` | Detail page loads with route, contact, status controls |
| 6.2 | Change status: `submitted` → `triaged` | DB: `quote.status='triaged'`, `audit_log` row inserted with `action='quote.status.update'` |
| 6.3 | Try **Convert to trip** action | **Expected to FAIL** with error message like "Attach a member to this quote first" (PR #11 IDOR fix — used to silently auto-bind by email). Quote remains `triaged`, no `trips` row created. |
| 6.4 | Verify DB: `select * from public.trips where quote_id = '<quote_id>'` | Returns zero rows |
| 6.5 | Open the messaging composer on the quote thread, channel dropdown | Includes `whatsapp` option (PR #12 fix — previously dead code) |
| 6.6 | Send a message: channel=`inapp`, body="QA test" | Inserts `messages` row, audit row, no email/SMS sent (inapp = logged-only) |
| 6.7 | Try createSoftHold against any aircraft from `/admin/quote/<id>` UI | Either succeeds with a soft-hold row in `aircraft_schedule_blocks`, OR shows a graceful error. Either is acceptable — just confirm no 500. |

### Suite 7 — health page deep-check

| # | Step | Expected |
|---|---|---|
| 7.1 | `/admin/health` page or `/api/health` JSON | Shape: `{ status, db: { ok, latencyMs }, stripe, email, twilio, sentry, plausible }` |
| 7.2 | `db.ok === true`, `db.latencyMs < 500` | Verified |
| 7.3 | `email.outbound.provider === 'resend'` | Confirms Phase 5 wired (post-redeploy) |
| 7.4 | `stripe.configured === false` | Expected (Phase 4 not wired) |
| 7.5 | `twilio.sms.configured === false` | Expected |
| 7.6 | `sentry.configured === false` | Expected |
| 7.7 | Top-level `status` | `"degraded"` is acceptable (some optionals missing); `"unhealthy"` is a fail |

### Suite 8 — quick performance + accessibility

Optional but useful:

| # | Step | Expected |
|---|---|---|
| 8.1 | Lighthouse on `/` | Performance ≥ 75, Accessibility ≥ 90, Best Practices ≥ 90 |
| 8.2 | Lighthouse on `/account` (post-auth) | Performance ≥ 70 |
| 8.3 | Mobile viewport check on `/` and `/quote/mission` | Layout doesn't break, no horizontal scroll, CTA buttons reachable |

---

## Reporting format

When done, produce a single report in this shape. **Markdown is fine.**

```
# JetNine production smoke — <ISO date>

Tested commit:    <sha + short message>
Tested deploy:    <dpl_id>
Test duration:    <minutes>
Overall verdict:  ✅ PASS / 🟡 PASS with warnings / 🔴 FAIL

## Critical findings (if any)
<list — each with reproduction steps + MCP query / screenshot evidence>

## Suite results
| Suite | Pass | Fail | Skip | Notes |
|---|---|---|---|---|
| 0 pre-flight |   |   |   |   |
| 1 marketing |   |   |   |   |
| 2 auth + open-redirect |   |   |   |   |
| 3 admin pages |   |   |   |   |
| 4 quote submission |   |   |   |   |
| 5 account pages |   |   |   |   |
| 6 dispatcher actions |   |   |   |   |
| 7 health page |   |   |   |   |
| 8 performance |   |   |   |   |

## Detailed per-step

<each step: id, status, evidence (log snippet / SQL result / screenshot path), notes>

## Recommendations

<launch blockers, nice-to-haves, deferred items>
```

Save the report somewhere accessible (a new branch's README, a GitHub
issue, or just paste it into the chat where you were launched).

## When you find a real bug

Do **not** open a PR. Do not attempt to fix anything. Include enough
detail in the report that someone can reproduce and fix:

- Which step (id) failed
- Exact request URL / form input / SQL query that triggered it
- The actual vs expected outcome
- One of: a screenshot, a runtime-log snippet, or a DB row dump
- Optionally: which code path you believe is responsible (read the
  files in §"Key codebase references" but do not change them)

---

## Quick reference — handy MCP one-liners

### Get latest production deploy state
```
list_deployments(projectId='jet-nine-website', teamId='team_di6oiEhCIT17lNXsonHt3mSc')
→ filter deployments[].target=='production', take [0].state and .meta.githubCommitSha
```

### Pull last 5 min of error logs
```
get_runtime_logs(
  projectId='prj_fcimzGWfsLIjGlYvQU3kmipbactr',
  teamId='team_di6oiEhCIT17lNXsonHt3mSc',
  since='5m', level=['error','warning','fatal'], limit=50
)
```

### Tail Supabase auth logs (magic-link flow)
```
get_logs(project_id='szuztxfhkudcjzhrkfld', service='auth')
→ filter event_message for "mail.send" / "login" / "/otp" / "/verify"
```

### Sanity-check the unique indexes from migration 0032
```
execute_sql(
  project_id='szuztxfhkudcjzhrkfld',
  query="select indexname from pg_indexes where schemaname='public' and indexname in (
    'trips_quote_id_uniq',
    'reserve_tx_refund_per_draw_uniq',
    'memberships_active_per_member_uniq',
    'schedule_blocks_hold_per_quote_aircraft_uniq',
    'reserve_tx_top_up_per_intent_uniq'
  )"
)
→ Should return all 5
```

### Most recent submitted quote
```
execute_sql(
  project_id='szuztxfhkudcjzhrkfld',
  query="select id, quote_code, status, contact_snapshot, received_at
         from public.quotes order by received_at desc limit 1"
)
```

### Confirm superadmin still good
```
execute_sql(
  project_id='szuztxfhkudcjzhrkfld',
  query="select u.id, u.email, u.role, au.email_confirmed_at is not null as verified
         from public.users u join auth.users au on au.id = u.id
         where u.email = 'alwayzlegit@gmail.com'"
)
```

---

That's the whole brief. Run Suite 0 first — if it passes, continue in
order. Report when done.
