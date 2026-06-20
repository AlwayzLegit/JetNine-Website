# HANDOFF — JetNine Website (updated 2026-06-20)

Self-contained brief for the next working session. Read this first.
Deeper detail: `MANUAL.md` (how the system works end-to-end), `RBAC.md`,
`DEPLOY.md`, `TESTING.md`, `LAUNCH.md`. Full history is in `git log`.

---

## 0. TL;DR — status: LAUNCHED ✈️

The site is **live on its real domain with the full money path, real brand,
and a clean database.** `https://jetnine.com` (+ `www`) serves with valid
SSL. Everything that was blocking launch is done.

**Open items (none blocking, mostly owner input):**
- **#30 F** — founder/team headshots (real photos only; drop on the issue).
- **#30 G** — confirm the three `/memberships` pricing tiers (one sentence).
- **#9 (QA)** — member 360 shows tier (e.g. CARD·100) while the program block
  reads "no active program". Arguably correct (tier set, no membership row);
  needs a product call on wording before changing.
- **Demo empty legs** `EL-2026-0001..0006` have **past dates** (May 2026) so the
  public `/empty-legs` board shows them as stale — refresh or hide before
  promoting that page.
- **DMARC** is `p=none` (monitor-only) — tighten to `quarantine`→`reject` after
  watching reports a couple weeks.
- **Phase F** — eyeball the transactional emails in the inbox for branding/typos.

---

## 1. Production, deploy, IDs

- **App:** Next.js (App Router) + Postgres via Supabase, hosted on Vercel.
- **Live:** `https://jetnine.com` (canonical) + `https://www.jetnine.com`
  (301 → apex). Auto-deploys from `main`. `NEXT_PUBLIC_SITE_URL=https://jetnine.com`
  is set, so Stripe redirects + email links use the real domain.
- **Branch convention:** develop on `claude/trusting-newton-vbxjlw`; it is
  **reset to `origin/main`** at the start of each task, so a force-push
  (`--force-with-lease`) right after the reset is expected and safe. PRs
  squash-merge to `main`; the owner's "go ahead / merge" = ship it.
- **Commit/PR footer:** end with the `https://claude.ai/code/session_…` line.

**Service IDs:**
| Service | ID / slug |
|---|---|
| Vercel team | `team_di6oiEhCIT17lNXsonHt3mSc` (`alwayzlegits-projects`) |
| Vercel project | `prj_fcimzGWfsLIjGlYvQU3kmipbactr` (`jet-nine-website`) |
| Supabase project | `szuztxfhkudcjzhrkfld` (us-east-2) |
| Sentry | org `jetnine`, project `jetnine-website` |
| PostHog | **shared** "Default project" `392626` in org `jetnine` — also serves other sites. **Always filter `$host = jetnine.com`.** |
| Stripe | `acct_1TdCAEKCpHyfNVWt` — **LIVE mode**, webhook wired |
| GitHub | `alwayzlegit/jetnine-website` (only repo in MCP scope) |

---

## 2. The stack — all wired (per `/api/health` + `/admin/health`)

- **DB (Supabase):** ✅ connected.
- **Stripe:** ✅ **live** secret + webhook. Money path verified.
- **Email (Resend):** ✅ outbound for all app transactional mail. Resend
  verified the **root `jetnine.com`** domain (DKIM at `resend._domainkey`,
  `send.jetnine.com` is its bounce/Return-Path subdomain). `EMAIL_FROM =
  JetNine <dispatch@jetnine.com>`, Reply-To = `dispatch@jetnine.com`.
- **Google Workspace** owns the root **MX** (inbound `@jetnine.com`) and
  coexists cleanly with Resend. **Never enable "Receiving" in Resend** — it
  would add a root MX and hijack inbound mail.
- **Supabase Auth → SMTP** is pointed at Resend (login/invite emails branded
  + no built-in rate limits).
- **Sentry / PostHog:** ✅ wired.
- **Twilio (SMS/WhatsApp) + Postmark inbound:** off by design (optional;
  that's the only reason `/api/health` reads `degraded`).

---

## 3. Auth (magic-link, passwordless)

- Sign-in (`/sign-in`) sends a magic link; member invites via admin.
- **Supabase → Auth → URL Configuration is set:** Site URL =
  `https://jetnine.com`; Redirect URLs include `https://jetnine.com/**` and
  `https://www.jetnine.com/**`. This is what makes the magic-link + invite
  redirects land on `/auth/callback` instead of the homepage.
- **Safety net (shipped #42):** `src/lib/supabase/middleware.ts` forwards a
  stray PKCE `?code=` on any non-callback page to `/auth/callback`, so login
  survives config drift. Verified live. (Invite uses a URL hash the server
  can't see → relies on the allowlist above.)

---

## 4. Database — clean, counters reset

Production DB was purged of all SMOKE/QA test data. Current live set:
- **Real:** 18 aircraft · 43 airports · 12 operators · 6 demo empty legs
  (`EL-2026-0001..0006` — note the stale dates, §0) · 1 owner user
  (`alwayzlegit@gmail.com`, superadmin).
- **Empty:** quotes, contact_inquiries, trips, invoices, members, watchlists,
  messages — all 0. Reference counters (quote/trip/invoice/member) reset to
  **0** so the first real record is `…-0001`. Audit log preserved (immutable).
- **Cleanup convention:** quote/contact submissions whose first name starts
  with `[SMOKE]` auto-cancel server-side and send no email. Test member
  accounts use `alwayzlegit+<tag>@gmail.com` plus-aliases. Purge both via SQL
  (Supabase MCP `execute_sql`) — delete child rows first (invoices→trips→
  quotes→contacts→watchlists→members→users); FK rules in the schema.

---

## 5. Shipped this session (2026-06-20)

- **#38** — photographic hero images on 5 marketing pages.
- **#34 (PR #39)** — admin invoice finalize (draft→due) + Stripe Pay-resume.
- **#40** — real JetNine logo wordmark + `/admin/health` site/domain + auth-
  email rows.
- **#41** — logo fix: full mark with the low-opacity "9" overlay (bone-tinted
  so it reads on the dark UI). Assets in `public/images/brand/`.
- **#42** — QA fixes: auth `?code=` safety net + sign-in error handling, contact
  validation/a11y, `/legal` OG, mobile-nav opacity, footer Turboprop, sign-in
  copy, SLA timers no longer tick on settled quotes.
- Domain switchover (jetnine.com + www), DB purge, full browser QA round.

---

## 6. QA — done; how to re-run

A full browser QA pass was completed (all user sides + iPhone-14 responsive).
The two blockers it found were **config, not code**: (1) the magic-link
redirect (fixed by the Supabase URL config in §3), and (2) the invoice-
finalize "freeze" — proven to be a downstream symptom of auth rate-limiting,
not a billing bug (the exact DB UPDATE persists instantly). Both should be
clear now; **re-test the two paths after any auth change**: sign-in → `/account`,
and admin trip sheet → Invoice "Finalize → Due" → member "Pay now".

**Re-running QA:** there's a pastable QA-agent brief (mission, scope, the
magic-link-via-Gmail login, `[SMOKE]`/`+qa` data hygiene, the **Stripe-is-LIVE**
"don't complete a real payment" warning). Ask the operator for it or re-derive
from §4 conventions. Admin login = `alwayzlegit@gmail.com` (magic link in the
owner's Gmail); provision test members by inviting `alwayzlegit+qaN@gmail.com`.

---

## 7. Conventions & gotchas

- **Stripe is LIVE.** Any "Pay now" goes to a real Checkout. Never complete a
  payment in testing — stop at the Stripe page.
- **PostHog** is a shared project → always filter `$host = jetnine.com`.
- **Branch reset + `--force-with-lease`** is the normal flow (§1).
- **Vercel MCP** has no env-var tools; **Supabase MCP** has no auth-config
  tools — those changes are dashboard-only.
- **`web_fetch_vercel_url`** on a full HTML page can exceed the token limit —
  it's saved to a temp file; slice with Bash.
- **Never** mask a command's exit code behind a pipe (`cmd | tail`) when
  gating on success — check `${PIPESTATUS[0]}` or write to a log + `echo $?`.
- **AI imagery policy:** OK for aircraft/cabin/abstract/editorial + the
  marketing heroes; NOT for real people's faces (issue #30) or factual maps.
