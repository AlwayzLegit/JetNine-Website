# Deploy runbook

This is the operator-side checklist for spinning up (or rotating) a JetNine production environment. Every external dependency ships dark — the app runs end-to-end without any of them — but for a real launch you want them all wired.

The codebase already reflects the design decisions; this doc is just the order of operations and where to find each secret.

---

## 0. Prerequisites

- Cloudflare account on **Workers Paid** (the bundle is over the free plan's 3 MB limit) with the `jetnine.com` zone. The site runs as the Worker `jetnine-web` (staging: `jetnine-web-staging`), built with the OpenNext adapter. Smart Placement keeps it near Supabase `us-east-2`.
- Until the cutover in §2 is finished, the Vercel project `jet-nine-website` still serves production and is the rollback target.
- Supabase project `szuztxfhkudcjzhrkfld` in `us-east-2`. All 31 migrations applied; check `drizzle.__drizzle_migrations` if drift is suspected.
- GitHub repo write access for whoever is running this.

---

## 1. Supabase

What you need from the dashboard:

| Env var | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → `anon` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → `service_role` (server-only — never expose) |
| `DATABASE_URL` | Settings → Database → Connection string → **Transaction pooler** (port 6543). Append `?sslmode=require&pgbouncer=true`. |
| `DIRECT_URL` | Settings → Database → Connection string → **Direct connection** (port 5432). Append `?sslmode=require`. Used by migrations only. |

The DB password is the one you set when the project was created. If you've lost it, regenerate it in Settings → Database → Reset database password (this rotates `DATABASE_URL` + `DIRECT_URL` everywhere — update the Hyperdrive config and Worker secrets after — see §2).

## 2. Cloudflare (Workers)

### One-time setup

Run these from the repo root after `pnpm exec wrangler login` (or with `CLOUDFLARE_API_TOKEN` set).

1. **Hyperdrive** pools database connections for the Worker.
   - Use the Supabase **session pooler** URL: Settings → Database → Connection string → Session pooler. That's port **5432** on host `aws-1-us-east-2.pooler.supabase.com`, user `postgres.szuztxfhkudcjzhrkfld`.
   - Don't use the 6543 transaction pooler, because Hyperdrive already does its own pooling.
   ```
   pnpm exec wrangler hyperdrive create jetnine-db --connection-string="postgresql://postgres.szuztxfhkudcjzhrkfld:PASSWORD@aws-1-us-east-2.pooler.supabase.com:5432/postgres"
   ```
   Put the printed id into both `<HYPERDRIVE_ID>` placeholders in `wrangler.jsonc`.
2. **Cache storage** backs ISR, `revalidate` and `revalidateTag`:
   ```
   pnpm exec wrangler r2 bucket create jetnine-next-cache
   pnpm exec wrangler r2 bucket create jetnine-next-cache-staging
   pnpm exec wrangler d1 create jetnine-tag-cache
   pnpm exec wrangler d1 create jetnine-tag-cache-staging
   ```
   Put the two D1 ids into `<D1_TAG_CACHE_ID>` and `<D1_TAG_CACHE_STAGING_ID>`.
3. **Images** handles next/image optimisation and blog hero resizing. Enable Images in the dashboard (Images → Overview). The `IMAGES` binding needs nothing else.
4. **Secrets.** Put the production values in a dotenv file that isn't committed. `vercel env pull .env.cloudflare --environment=production` copies them from Vercel. Then run:
   ```
   bash scripts/set-wrangler-secrets.sh .env.cloudflare            # production Worker
   bash scripts/set-wrangler-secrets.sh .env.cloudflare staging    # staging Worker
   rm .env.cloudflare
   ```
5. **GitHub** (Settings → Secrets and variables → Actions):
   - Secrets:
     - `CLOUDFLARE_API_TOKEN`: create it from the "Edit Cloudflare Workers" template and add D1, R2 and Hyperdrive permissions.
     - `CLOUDFLARE_ACCOUNT_ID`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `DATABASE_URL`: the transaction pooler URL. The build prerenders pages that read the database, as Vercel builds did.
   - Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`.
   - The `NEXT_PUBLIC_*` values are compiled into the build, so they must be set here, not only in Worker secrets.

**Deploys**
- Every push to `main` deploys **staging** through `.github/workflows/deploy-cloudflare.yml`, then runs the post-deploy smoke test against `https://staging.jetnine.com`.
- Until the cutover, deploy production by running that workflow manually (workflow_dispatch) with target `production`. After the cutover, change the push target in the workflow to production.

**Deploying from the bundle** (until `CLOUDFLARE_API_TOKEN` exists)
- Run `.github/workflows/staging-bundle.yml` (workflow_dispatch, target staging or production) and download the `open-next-<target>` artifact. It is built on Linux because OpenNext can't build on Windows.
- Unpack it over `.open-next/` in the checkout, then rewrite the runner's absolute paths that the build bakes into `handler.mjs` wasm imports: replace `/home/runner/work/JetNine-Website/JetNine-Website` with the local checkout path (forward slashes) in every file under `.open-next/`.
- `wrangler deploy --dry-run --env staging` (or no `--env` for production) must list every binding before you deploy for real.
- Deploy with `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE=postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder pnpm exec opennextjs-cloudflare deploy --env staging`. The variable is only parsed by the local Miniflare proxy that populates the cache; any valid URL works, it is never connected to.

**Local**
- `pnpm dev` is unchanged and still talks to `DATABASE_URL`.
- `pnpm cf:preview` builds the Worker and serves it in workerd. It needs `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE=<DATABASE_URL>` in the environment.
- Build on Linux, WSL or in CI. OpenNext warns that builds on Windows are unreliable.

### Cutover (zero downtime)

DNS for `jetnine.com` is already on Cloudflare, so switching over is a route change. There's no DNS propagation to wait for.

1. **Get staging green.**
   - The smoke workflow passes on `staging.jetnine.com`.
   - Check by hand: sign-in, the quote wizard, the admin desk, and invoice → Stripe Checkout (stop before paying).
   - Staging runs no crons.
2. **Stop the Vercel crons first.** Remove the `crons` array from `vercel.json` and push; wait for that Vercel deploy to finish. The production Worker's crons are live from its first deploy, so this has to happen before step 3 or every job runs twice for a while. The gap is a few minutes of no `sla-watch`, which is fine.
3. **Deploy production once** (workflow_dispatch → production, or from the bundle, see below). It's only reachable on its `*.workers.dev` URL, but its crons are already running against the shared database. Check `/api/health` and the first `*/10` cron in Workers logs.
4. **Do these together, in this order:**
   1. In `wrangler.jsonc`, uncomment the production `routes` (jetnine.com and www).
   2. Delete the DNS records for `jetnine.com` and `www` that point at Vercel. Cloudflare won't attach a custom domain over an existing record. Write down their values first; you need them to roll back.
   3. Deploy production again. The Worker takes over both hostnames.
   4. Change the push target in `deploy-cloudflare.yml` to production.
5. **Check the switch worked:**
   - `curl -sI https://jetnine.com | grep -i server` shows `cloudflare`, and there's no `x-vercel-id` header.
   - `/api/health` returns 200 with `"ok": true`. With `Authorization: Bearer $CRON_SECRET` it also reports `region: cloudflare` and the commit.
   - Workers logs show the next `*/10` cron (`sla-watch`) returning 200.
6. **Webhooks need no edits.** Their URLs don't change (`/api/stripe/webhook`, `/api/twilio/inbound`, `/api/email/inbound/…`, `/api/voice/*`), so Stripe, Twilio and Postmark keep working as they are.

**Rollback**
1. Remove the custom domains from the edge Worker (`jetnine-edge`), or comment out `routes` in `edge/wrangler.jsonc` and redeploy it.
2. Recreate the two DNS records pointing at Vercel. Values at cutover (2026-11-03), both DNS-only:
   - `jetnine.com` CNAME `5e51739dca5adc0a.vercel-dns-016.com` (Cloudflare flattens it to Vercel's A records)
   - `www.jetnine.com` CNAME `5e51739dca5adc0a.vercel-dns-016.com`
3. Restore `crons` in `vercel.json`.

Keep the Vercel project for two weeks after the cutover before deleting it.

### Edge cache Worker

The public hostnames (`jetnine.com`, `www`, `staging.jetnine.com`) are attached to a second, very small Worker, `jetnine-edge` / `jetnine-edge-staging` (`edge/worker.ts`, `edge/wrangler.jsonc`). It forwards to the app through a service binding and keeps public pages in the data centre cache.

Why: the app is a ~34 MB script, and Cloudflare loads it into a fresh isolate for a large share of requests on a low-traffic site. That load took 1–3 s even for pages Next already had cached. The edge Worker is a few kilobytes and answers a cached page in about 0.15 s.

- **What is cached:** anonymous `GET` requests for HTML the app marks with `s-maxage` (the ISR marketing pages). Served as-is for up to 5 minutes, then stale for up to a day while a background request refreshes it. API routes, `/quote`, `/account`, `/admin`, `/sign-in`, signed-in visitors, query strings and RSC navigations always pass through. The `x-edge-cache` response header says `HIT`, `STALE` or `MISS`.
- **Every release deploys both Workers, app first.** The edge Worker's `APP_VERSION` keys the cache; pass the released commit so the cache starts empty. Old HTML points at the previous build's script files, which no longer exist.

  ```bash
  pnpm exec opennextjs-cloudflare deploy -- --env ""
  pnpm exec wrangler deploy -c edge/wrangler.jsonc --env "" --var APP_VERSION:$(git rev-parse HEAD)
  ```

  For staging use `--env staging` in both. The deploy workflow does this itself.
- **An admin edit shows within about 5 minutes** on a cached page (the fresh window), plus one more visit to trigger the refresh. To clear everything at once, redeploy the edge Worker with a different `APP_VERSION`.
- **To take the cache out of the path,** deploy the edge Worker with `--var APP_VERSION:` (empty): it then forwards every request. To remove the Worker entirely, add the `routes` back to `wrangler.jsonc` and deploy the app; the custom domains move in that one step.

### Site media (blog hero images)

Blog hero images live in the R2 bucket `jetnine-media` (created once with `wrangler r2 bucket create jetnine-media`) under `blog/heroes/`. The app writes uploads there through its `MEDIA` binding and the edge Worker serves them at `/media/blog/heroes/<file>.webp`, cached for a year (filenames are never reused).

They used to be hot-linked from Supabase Storage, which ran the project past its egress quota (Supabase then answers every file with `402`). Posts written before the move still store the Supabase URL; `src/lib/media.ts` maps it to the `/media` path on read, and the edge Worker copies each old file out of Supabase the first time it is requested (`MEDIA_LEGACY_ORIGIN`). Once every old image has been viewed once, the Supabase `blog` bucket is no longer read.

## 3. Stripe (optional — payments + member purchase)

Without Stripe keys, the Pay-now button on `/account/invoices` returns `STRIPE_NOT_CONFIGURED` and the Activate buttons on `/account/memberships` do the same. The rest of the app is unaffected.

1. Create a Stripe account at https://dashboard.stripe.com. Toggle Test mode for first-pass verification.
2. Set as Worker secrets (`pnpm exec wrangler secret put NAME`):
   - `STRIPE_SECRET_KEY` — Dashboard → Developers → API keys → Secret key (`sk_test_…` / `sk_live_…`).
3. Create the webhook:
   - Dashboard → Developers → Webhooks → Add endpoint.
   - URL: `https://YOUR_DOMAIN/api/stripe/webhook`.
   - Events: `checkout.session.completed`, `payment_intent.payment_failed`, `charge.refunded`.
4. Copy the signing secret (`whsec_…`) as the Worker secret `STRIPE_WEBHOOK_SECRET`.
5. Test: from `/account/invoices`, click Pay-now on a due invoice. From `/account/memberships`, click Activate on Card · 100.

## 4. Email (optional — transactional sends)

Without these, every `sendEmail()` call falls through to a stdout logger. The dispatcher UI still shows green `sent · logger` pills.

**Outbound** — Resend OR Postmark; pick one:

| Env var | Notes |
|---|---|
| `RESEND_API_KEY` | https://resend.com → API Keys → New |
| `POSTMARK_SERVER_TOKEN` | https://account.postmarkapp.com → Server → API Tokens. Required only if Resend isn't used. |
| `EMAIL_FROM` | `"JetNine <dispatch@jetnine.com>"`. Required when either provider key is set. Sender must be verified with the provider. |
| `DISPATCH_NOTIFY_EMAIL` | Default `dispatch@jetnine.com`. Where new-quote alerts go. |

**Inbound** (Postmark only for now):

| Env var | Notes |
|---|---|
| `INBOUND_EMAIL_SECRET` | 32+ random chars (`openssl rand -hex 32`). Used as the path segment of the inbound webhook URL. |

Then register the webhook in Postmark:
- Dashboard → Servers → Inbound Stream → Webhook URL: `https://YOUR_DOMAIN/api/email/inbound/$INBOUND_EMAIL_SECRET`.

## 5. Twilio (optional — SMS)

Without these, `channel='sms'` on dispatcher threads falls through to the logger and trip-status auto-SMS is `skipped` for every member.

| Env var | Notes |
|---|---|
| `TWILIO_ACCOUNT_SID` | Console → Account → API keys. Starts `AC…`. |
| `TWILIO_AUTH_TOKEN` | Same panel. **Server-only.** |
| `TWILIO_SMS_FROM` | E.164 number you own in Twilio. e.g. `+18885551234`. |

Configure inbound:
- Console → Phone Numbers → your number → Messaging → A MESSAGE COMES IN.
- Webhook: `https://YOUR_DOMAIN/api/twilio/inbound`, method `HTTP POST`.

The route verifies Twilio's signature using `TWILIO_AUTH_TOKEN`; no path-based secret needed.

**WhatsApp** uses the same Twilio account. Set:

| Env var | Notes |
|---|---|
| `TWILIO_WHATSAPP_FROM` | `whatsapp:+E164` of your WABA-approved sender. Sandbox value for dev: `whatsapp:+14155238886`. |

Dev sandbox: members text "join <code>" to the sandbox number from their phone before we can reach them. Production needs a WhatsApp Business Account (WABA) registration through Twilio + Meta — allow a week for approval. Outbound-first messages from a WABA sender require pre-approved templates; once the customer initiates a conversation, freeform replies work for 24h after each message.

## 6. Sentry (optional — error tracking)

Without a DSN, error boundaries log to `console.error` only.

| Env var | Notes |
|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry → Project → Settings → Client Keys (DSN). |
| `SENTRY_DSN` | Same project's DSN. Can be the same value. |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | Optional, default `0.1`. |

The SDK lazy-loads on the client (no bundle cost when DSN is missing).

## 7. Analytics & SEO verification (optional)

| Env var | Notes |
|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog → Project Settings → Project API key (`phc_…`). SDK lazy-loads client-side only when set. |
| `NEXT_PUBLIC_POSTHOG_HOST` | Optional. Defaults to `https://us.i.posthog.com`; only set for EU cloud or self-hosted. |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Search Console → Add property → meta tag method → copy the `content="..."` value. |

After PostHog is wired, submit the sitemap to Search Console at https://search.google.com/search-console → Sitemaps → Add `sitemap.xml`.

## 7b. Turnstile on the public forms (optional)

The contact form, the quote wizard's last step and the empty-leg watchlist form can ask Cloudflare Turnstile for a human check. It is off until both keys exist, and the honeypots and per-IP rate limits apply either way.

1. Cloudflare dashboard → Turnstile → Add widget. Hostnames `jetnine.com` and `staging.jetnine.com`, mode Managed.
2. Site key (public, inlined at build time): add it as the GitHub repository variable `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
3. Secret key: `wrangler secret put TURNSTILE_SECRET_KEY` (and again with `--env staging`).
4. Deploy. The widget stays invisible unless Cloudflare wants an interaction.

Submissions flagged `[SMOKE]` skip the check, so the post-deploy suite keeps passing. If Cloudflare's verify endpoint is unreachable the submission is allowed and the error is logged. To switch it off, delete the secret and redeploy.

## 8. AI providers (voice desk)

The voice desk on Render needs a model vendor. Keys are not env vars: an admin
stores them at `/admin/settings/ai` (Anthropic and/or OpenAI, each with a
default model) and sets the **Voice desk** route to a primary and optional
fallback provider. The page tests a key by listing the vendor's models with it.

| Env var | Notes |
|---|---|
| `AI_KEYS_ENCRYPTION_KEY` | `openssl rand -hex 32`. Encrypts the stored keys. **Same value in the site's Worker secrets and on the voice service.** |
| `ANTHROPIC_API_KEY` (Render only) | Optional fallback when nothing is routed in the admin. |

Schema: migration `0047_ai_providers.sql` (tables `ai_providers`, `ai_routes`,
audit subject `ai_provider`). Admin-only (`requireAdmin`), every change audited
as `ai_provider.*` / `ai_route.update`; key material never appears in the
audit log or the UI (last four characters only).

## 8b. Guest status link (redesign phase 3)

Schema: migration `0048_quote_status_token.sql` adds `quotes.status_token`
(24 random bytes, hex, unique) and backfills existing rows. Apply it before
deploying the phase-3 build — the submit action writes the column. The page
`/request/<token>` is `noindex` and disallowed in robots; lookups are
rate-limited per IP. No new env vars. Migration `0049_quotes_anon_select_revoke.sql`
(also applied) removes the anon-key read path on `quotes` / `quote_legs` that 0003
left open and rotates every token; keep it applied before 0048's links go out.

## 8c. Dispatch desk settings (redesign phase 5)

Schema: migration `0050_desk_settings.sql` adds `staff_notification_prefs`
(one row per staff user; absent row = defaults) and `desk_settings`
(key/value; seeded with `reply_promise_minutes = 30`). Apply it before
deploying the phase-5 build — Settings › Notifications reads and writes both,
and the quote submit action reads the reply promise (it falls back to 30
minutes if the table is missing, so a late migration degrades rather than
breaks). No new env vars. A new cron `/api/cron/morning-summary` runs at 7 AM
Los Angeles for staff who turned the morning summary on (same `CRON_SECRET`).

Old desk URLs (`/admin/dispatch`, `/admin/quote/<id>`, `/admin/trip/<id>`,
`/admin/member/<id>`, `/admin/inquiries`, `/admin/voice`, `/admin/reports`,
`/admin/audit`, `/admin/health`) redirect to the five new sections, so links
in older dispatch emails keep working.

## 8d. Desk API keys (API phase 1)

Schema: migration `0051_api_keys.sql` adds `api_keys` (hashed keys, scopes,
expiry, revocation) and `api_requests` (per-call log), and six audit subject
types (`api_key`, `blog_post`, `approval`, `agent_run`, `agent_playbook`,
`agent_memory`). Apply it before deploying — the blog endpoints now write
audit rows with `subject_type = 'blog_post'`; without the enum values those
rows are silently dropped (audit is best-effort) and `/api/v1` answers 503. No new env vars; `BLOG_ADMIN_API_KEY` keeps working on the legacy
`/api/admin/blog/*` paths. API reference: `docs/API.md`.

## 8e. Desk assistant tables (API phase 4)

Schema: migration `0052_agent.sql` adds `agent_playbooks`, `agent_runs`,
`agent_run_items` and `agent_memory` (all RLS on, no policies; server-only).
Apply it before deploying — `/api/v1/agent/*` reads and writes them. No new
env vars. The scheduled task moves to the bootstrap prompt in
`docs/AGENT_HANDOFF.md` with a key from Settings › API keys.

## 8e2. The site's own sign-in (OPS-91)

Schema: migration `0056_site_sessions.sql` adds `user_sessions` (one row per
signed-in browser, only the SHA-256 of the cookie token) and
`user_credentials` (a password set after this change, bcrypt). RLS on, no
policies, no grants for `anon` or `authenticated`. It is additive: running it
changes nothing the live site reads. Apply it **before** the deploy:

```
DATABASE_URL="$DIRECT_URL" pnpm db:migrate
```

(or run the file in the SQL editor; it uses `if not exists`). Check: `select
count(*) from public.user_sessions;` returns 0. Way back: `drop table
public.user_sessions, public.user_credentials;` after reverting the merge.

Sign-in no longer calls Supabase Auth: `src/lib/session` checks the password
in place (the older bcrypt hash in `auth.users.encrypted_password`, or a newer
one in `user_credentials`, which wins), keeps the session on the server and
sets the host-only cookie `__Host-jn_session`. Sessions last 30 days and end
after 7 idle days, on sign-out and on a password change. Emailed sign-in links,
password reset mails and invites moved to the site's own mail in OPS-94 (8e3);
`/auth/callback` stays only for Supabase links already sent. A password changed after this
change is not known to Supabase, so after a revert that member resets it
again. `/api/health` shows `signin` in `failing` when the tables are missing.
No new secret.

## 8e3. Emailed links on the site's own mail (OPS-94)

Schema: migration `0057_auth_tokens.sql` adds `public.auth_tokens` (a one-time
token per row, only its SHA-256 stored, purpose `signin` 15 min, `reset` 30
min, `invite` 7 days) and lets the site create a `public.users` row itself: it
drops the foreign key `users_id_users_id_fk` to `auth.users` and gives `id` a
default. RLS on, no policies, no grants for `anon` or `authenticated`.
Additive for the live site. Apply it **before** the deploy (staging shares the
production database):

```
DATABASE_URL="$DIRECT_URL" pnpm db:migrate
```

(or run the file in the SQL editor; it is safe to run twice). Check:
`select count(*) from public.auth_tokens;` returns 0. Way back: see the header
of the file.

The sign-in link, the password reset mail and staff and client invites no
longer call Supabase Auth. They go out through `src/lib/email.ts`, so **each
environment needs `RESEND_API_KEY` or `POSTMARK_SERVER_TOKEN` plus
`EMAIL_FROM`**. Links are built from `NEXT_PUBLIC_SITE_URL` (never the Host
header) and open `/auth/link`, which only shows a button: the token is spent
by the POST behind it, so a mail scanner that fetches the link cannot use it
up. In production with no mail provider the send reports a failure instead of
logging the link. The Supabase email templates are no longer used for new
links. `/auth/callback` stays for links Supabase already sent.

D1 twin (OPS-100 is on main): `src/db/d1/schema/sessions.ts` gains `authTokens`
and the D1 `users.id` gets an app-side default. The generated D1 migration is
`src/db/d1/migrations/0001_cynical_lady_deathstrike.sql` (one new table). It is
not applied anywhere yet; production stays on Postgres until the cutover row.

## 8f. Approval queue (API phase 5)

Schema: migration `0053_approvals.sql` adds `approvals` (RLS on, no
policies; server-only). Apply it before deploying — client-facing desk
writes called by a key that "asks before acting" are stored there and
return a 202 instead of running. People decide them in Messages › Needs
your OK; the `api-maintenance` cron expires anything undecided after 7
days. No new env vars.

## 8g. Cutting the scheduled task over to the assistant (API phase 8)

No schema or env changes. The runbook, in order:

1. Admin › Settings › API keys → Create a key → template **Daily assistant**
   (read, content, desk, assistant; asks before acting; 90 days). Copy it
   once; it is never shown again.
2. In Cowork, open the existing daily blog task. Disable it (do not delete
   it yet) and create the new one with the prompt in `docs/AGENT_HANDOFF.md`,
   the key pasted in, the Hugging Face connector on, Semrush optional.
3. Run the new task once by hand. Admin › Settings › Assistant › Today shows
   the run, its report and its items; Messages › Needs your OK shows anything
   it proposed.
4. Watch Settings › API keys for a week: the assistant key "used today" every
   day, and **The old blog key** card showing no calls. When it reads
   "Safe to remove", run `pnpm exec wrangler secret delete BLOG_ADMIN_API_KEY` and
   delete the old task. The legacy `/api/admin/blog/*` routes go in phase 10.

## 8h. Monitor Worker (OPS-60)

`jetnine-monitor` (folder `monitor/`) checks the site from outside it every 15 minutes and serves `GET /status`. It is a Worker of its own, so it keeps answering when the site does not. The deploy workflow's `monitor` job deploys it after the app and the edge Worker, with the same two repo secrets. Its state lives in one Durable Object declared in `monitor/wrangler.jsonc`: no namespace id, no dashboard step. Staging has its own copy, `jetnine-monitor-staging`.

- **What it checks:** `/api/health` answers 200 with `ok` true; `/`, `/contact` and `/cost-calculator` carry their title text; a path that does not exist must answer 404 (the canary: proof the probes can see a failure; it never raises an incident). GET only, a failed check is tried once more after 30 seconds.
- **The status address:** `https://jetnine-monitor.jetnine-inc.workers.dev/status` (staging: `jetnine-monitor-staging`). Fixed fields only: `v`, `ok`, `checkedAt`, `failingSince`, `streak`, `checks`, `canary`, `alerts`, `quietUntil`, `wouldHaveRaised`, `incidents`. 503 when the last round is over 45 minutes old. The daily `monitor-status` job of `health-monitor.yml` reads it (and a run by hand can read another address with `status_url`).
- **Quiet start:** `QUIET_UNTIL` in `monitor/wrangler.jsonc` is at least 24 hours after the merge. Before it a failing round is only written to `wouldHaveRaised`: no incident, no email. Move it first when the merge comes later than the date in the file. The old 15 minute GitHub check was removed by OPS-63 once the record was read and alerts were configured.
- **Alerts (owner step, optional):** `pnpm exec wrangler secret put ALERT_EMAIL -c monitor/wrangler.jsonc`, then the same with `RESEND_API_KEY` or `POSTMARK_SERVER_TOKEN` (the value the site uses; `ALERT_FROM` is optional). It worked when `/status` shows `"alerts":"configured"`. Without them the monitor records and never emails.
- **Sign-in service check (OPS-90):** a fifth check reads `/api/health` and fails when its `failing` list names `auth`, which `/api/health` does when Supabase Auth does not answer 200 (since OPS-91 that guards emailed links, resets and invites; password sign-in has its own `signin` check in the same list, which this monitor check does not read), as when the project was restricted on 2026-11-16 (402). `/api/health` itself stays 200 and `ok` stays true then, so deploy smoke tests do not fail while the project is down. The check has its own quiet date, `SIGNIN_QUIET_UNTIL` in `monitor/wrangler.jsonc` (both envs): before it a failure is only written to `wouldHaveRaised`. Keep it at least 24 hours after the merge, and move it first when the merge comes later than the date in the file. A missing or broken value stays quiet.
- **Silence it:** `pnpm exec wrangler delete --name jetnine-monitor` (owner), or push `QUIET_UNTIL` far into the future.

## 8i. Database target (D1 move, OPS-99)

JetNine's database is moving from Supabase Postgres to Cloudflare D1, one domain at a time.

- **Binding.** The staging Worker has a D1 binding `DB` (database `jetnine-staging`, migrations in `src/db/d1/migrations`). Production has no such binding and stays on Postgres.
- **Switch.** `DB_TARGET` (`postgres` or `d1`) names the database per environment. Staging sets `postgres` until the first converted domain row changes it. `src/db/target.mjs` reads it: anything but exactly `d1` means Postgres, and production refuses `d1` by code until the cutover row lifts that on purpose.
- **Code.** `dbTarget()` and `d1Db()` in `src/db/d1.ts` (re-exported from `src/db`). `db` and `sql` still point at Postgres; a converted domain calls `d1Db()` when `dbTarget()` is `d1`.
- **Health.** `checks.db` in `/api/health` (full view and `/admin/health`) shows `target`, `d1` (`absent`, `ok` or `error`) and `d1Tables`. D1 never changes `ok` or the status.
- **Converted to D1: blog (posts, subscribers), OPS-109.** Staging runs `DB_TARGET` `d1`, so the blog reads and writes the D1 twin tables through `src/domain/blog/store.ts` (a Postgres adapter and a D1 adapter, one chosen per request by `dbTarget()`). Production stays on Postgres. Other domains on staging still use Postgres through Hyperdrive. Undo on staging: set `DB_TARGET` back to `postgres` in `wrangler.jsonc` and redeploy staging.
- **Migrations.** The staging run of "Deploy (Cloudflare)" applies D1 migrations (`wrangler d1 migrations apply jetnine-staging --env staging --remote`) with the repo's own `CLOUDFLARE_API_TOKEN`, then prints `D1 jetnine-staging tables: N`.
- **Converted to D1: reference data (operators, operator contacts, aircraft, airports, FBOs), OPS-112.** The admin lists, detail pages and editors, the ops board fleet list and `/api/v1/reference` read and write through `src/domain/reference/store.ts` (a Postgres adapter and a D1 adapter, one chosen per request by `dbTarget()`); production stays on Postgres. Staging-only effect: once staging runs `d1`, an operator, aircraft or airport created on staging lives only in staging D1, so choosing it in a staging request or trip form (still Postgres) fails on the foreign key, until those domains move. Undo on staging: set `DB_TARGET` back to `postgres` in `wrangler.jsonc` and redeploy staging.
- **Converted to D1: empty legs and their codes (not watchlists), OPS-113.** The public board at `/empty-legs`, the admin list and the new-leg form, the status change, the v1 empty-legs API, the watchlist cron's read of live legs and the empty-legs count on `/admin/settings/reference` read and write through `src/domain/empty-legs/store.ts` (a Postgres adapter and a D1 adapter, one chosen per request by `dbTarget()`); production stays on Postgres. On D1 the EL code and the insert are one `db.batch` (the counter upsert first, then the insert, which reads the counter in SQL with `codeSql` in `src/db/codes.ts`), so a failed insert gives the number back as the Postgres transaction did. The smoke prints `empty legs on board: N` so staging and production can be compared. Undo on staging: set `DB_TARGET` back to `postgres` in `wrangler.jsonc` and redeploy staging.
- **Converted to D1: empty-leg watchlists and their matches, OPS-116.** The board signup, the confirm page and action, the unsubscribe page and links, SMS STOP and START, the account preferences list (delete, pause and resume) and the watchlist cron's sweep, load, ledger, claim and status write go through `src/domain/empty-legs/watchlist-store.ts` (a Postgres adapter and a D1 adapter, one chosen per request by `dbTarget()`); production stays on Postgres. A D1 query takes at most 100 bound values, so the cron's ledger read splits the live legs into chunks of 50. A match row needs its watchlist and its leg in D1 (foreign keys are on), so this merges after the empty-legs store (OPS-113). The member link on a signed-in signup is read from Postgres until the members domain moves. The smoke prints `watchlist confirm lookup: ok` (a made-up confirm token must answer "This link is no longer valid"), so staging and production can be compared. Undo on staging: set `DB_TARGET` back to `postgres` in `wrangler.jsonc` and redeploy staging.
- **Converted to D1: contact form and guide download leads (contact_inquiries), OPS-122.** The public contact form, the pricing guide download form, the desk's new-inquiry count, the admin Website form tab and its handle and reopen action read and write through `src/domain/contact/store.ts` (a Postgres adapter and a D1 adapter, one chosen per request by `dbTarget()`); production stays on Postgres. The audit log and the rate limits stay on Postgres (OPS-123). Staging-only effect: on staging the signed-in user and member come from Postgres, so a contact form sent by a signed-in member created after the last D1 copy, or a handle by a staff user created after it, fails on the D1 foreign key; anonymous sends, the guide form and staff copied by the D1 load work. Undo on staging: set `DB_TARGET` back to `postgres` in `wrangler.jsonc` and redeploy staging.
- **Converted to D1: audit log and rate limits, OPS-123.** `logAudit()` appends through `src/lib/audit-store.ts`, Settings > History and `GET /api/v1/history` read through `src/domain/history/store.ts`, and `checkRateLimit()` counts in a D1 table `request_rate_limits` (one text key `bucket|windowStart`; D1 migration 0002; never copied from Postgres, it is held back in `scripts/d1-copy/tables.ts`), each with a Postgres side and a D1 side chosen by `dbTarget()`; production stays on Postgres. Staging-only effect: the actor of an audit row comes from Postgres on staging, so a staff user created after the last D1 copy fails the D1 foreign key; `logAudit` swallows it and logs `[audit-failure]`, the action still succeeds. Staging now counts its own rate limits instead of sharing production's table. The `sla-watch` cron's read of `audit_log` moves with the quotes row, not this one. Undo on staging: set `DB_TARGET` back to `postgres` in `wrangler.jsonc` and redeploy staging.
- **Converted to D1: desk settings, staff notification choices and voice agent configs, OPS-126.** The reply-time promise, voice call routing and social links (`desk_settings`), a person's notification toggles and who gets paged (`staff_notification_prefs`), and the voice agents with their saved versions (`voice_agents`, `voice_agent_versions`: Settings, Voice agent) read and write through `src/domain/settings/store.ts` and `src/domain/voice-agents/store.ts` (a Postgres adapter and a D1 adapter each, one chosen per request by `dbTarget()`); production stays on Postgres. The three voice agent transactions (create, save, make live) are one D1 batch each, and a second save of the same agent version still fails cleanly ("Someone else saved this agent just now"). The team list and emails-sent count stay on Postgres (users and messages move with their own rows), the audit log with OPS-123, and the voice service in `voice/` keeps reading Postgres (its own row). Staging-only effects: a voice agent saved on staging lives in staging D1 and no voice service reads it; and on staging the staff come from the last D1 copy, so a staff user created in Postgres after it cannot save notification choices (D1 foreign key) and is not paged by the staging recipient read. Undo on staging: set `DB_TARGET` back to `postgres` in `wrangler.jsonc` and redeploy staging.
- **Converted to D1: the desk's messages (inbox, threads, delivery status, inbound email and SMS), OPS-127.** Every query on the `messages` table goes through `src/domain/messages/store.ts` (a Postgres adapter and a D1 adapter, one chosen per request by `dbTarget()`): the admin Messages inbox and its unread count, one thread (also on a request and a trip), failed deliveries, mark read and retry, the desk counts, the emails-sent-today count (the Los Angeles day is computed in the app, `src/domain/messages/day.ts`), a member's trip timeline, the Postmark and Twilio inbound webhooks, the Resend bounce events, and the message writes inside request and trip commands; production stays on Postgres. D1 migration 0003 adds the partial unique index `messages_inbound_provider_id_uq` (the twin of Postgres migration 0029) so a webhook the provider retries still lands once. Lookups into quotes, trips, members and users stay where they are, and the voice service's tables are OPS-129's. Staging-only effect: a message written on staging by a staff user, or to a client, created in Postgres after the last D1 copy fails the D1 foreign key (the post returns `DB_INSERT_FAILED`), and on staging the inbox lists D1 threads while their names are looked up in Postgres, so a thread whose request or trip exists in only one of the two shows without a name; the inbound webhooks call production only. Undo on staging: set `DB_TARGET` back to `postgres` in `wrangler.jsonc` and redeploy staging.
- **Converted to D1: API keys and the API request log, OPS-138.** Settings > API keys (list with the 24 hour counts, create with the cap of 25 working keys, revoke, the old blog key's usage), the `/api/v1` key sign-in and its last-used stamp, `GET /api/v1/me`'s key limits, the request log written by `/api/v1` and by the legacy blog route, and the daily clean-up of log rows older than 30 days read and write through `src/lib/api-key-store/store.ts` (two views of one store, a runtime view for `src/app/api` and a management view for `src/domain/api-keys` only, which `pnpm check:api` enforces; a Postgres adapter, today's queries moved as they were, and a D1 adapter, one chosen per request by `dbTarget()`); production stays on Postgres. The cap is one statement on D1 (`insert ... select ... where (count of working keys) < cap`), which replaces the Postgres advisory lock, so two creates together at the cap give one key. Key hashes are held back from the D1 copy on purpose (`scripts/d1-copy/tables.ts`), so a key made in production does not exist on staging: staging keys are made in the staging admin and live in staging D1 only. Staging-only effects: (1) the key sign-in takes the creator's role from Postgres `users` (the source of truth until the users domain moves), not from the D1 copy, so a person demoted or removed in Postgres loses a staging key's authority at once; if that read fails the sign-in answers "temporarily unavailable". (2) A key made in the staging admin exists only in D1, and the agent and approvals tables still point at Postgres `api_keys`, so on staging an agent run (`agent_runs.key_id`) or a new supervised proposal (`approvals.requested_by_key`) made with such a key fails its foreign key until the agent row (OPS-142) and the approvals row move; reads and every other call work. Approvals' read of a key name stays on Postgres (it moves with approvals), and the agent's open-run check is the agent store's row. The smoke prints `api key lookup: 401 for a made-up key` (a key of the right format that matches nothing), so staging and production can be compared. Undo on staging: set `DB_TARGET` back to `postgres` in `wrangler.jsonc` and redeploy staging.
- **Converted to D1: the phone line's call notes (the admin Messages Calls tab and `GET /api/v1/messages/calls`), OPS-129.** `listCallNotes()` reads through `src/domain/voice/call-notes-store.ts` (a Postgres adapter, today's SQL moved as it was, and a D1 adapter, one chosen per request by `dbTarget()`); production stays on Postgres. The four voice tables (`voice_leads`, `voice_calls`, `voice_trip_requests`, `voice_messages`, Postgres migration 0038, raw SQL only) now have D1 twins in `src/db/d1/schema/voice-calls.ts` (D1 migration 0004) and the D1 copy (OPS-105) carries them to staging. SQLite has no LATERAL, so a call's latest message is two correlated subqueries. The voice Worker in `voice/` still writes Postgres only (its own row), so on staging the Calls tab shows the calls of the last D1 copy and no new ones. Undo on staging: set `DB_TARGET` back to `postgres` in `wrangler.jsonc` and redeploy staging.
- **Converted to D1: the voice Worker's own queries (`voice/`), OPS-137.** Every query in `voice/src/db/queries.ts`, `voice/src/agent-store.ts` and `voice/src/llm/providers.ts` goes through one store (`voice/src/db/store.ts`: a Postgres side with today's SQL, `store-pg.ts`, and a D1 side over the `DB` binding, `store-d1.ts`), chosen on every call by `DB_TARGET` and `DEPLOY_ENV` with the site's rule (`voice/src/db/target.ts`, a copy of `src/db/target.mjs`): anything but `d1` is Postgres, and `DEPLOY_ENV` `production` (a var in `voice/wrangler.jsonc`) never gets D1. D1 with no `DB` binding throws instead of reading an empty database. `/health` gains `db: { target, ok }` (one `select 1`, 3 second limit; it never changes the status code). A new staging voice Worker, `jetnine-voice-staging` (`voice/wrangler.jsonc` `env.staging`, no custom domain, no Twilio, LLM or encryption secret, so it takes no calls and its `/health` answers 503 for the missing settings), binds the staging D1 database `jetnine-staging` and runs `DB_TARGET` `d1`; the step "Deploy staging voice Worker" of Deploy (Cloudflare) (staging target only) deploys it after the site and prints `voice staging db: target=d1 ok=true`. CI runs a `voice` job (typecheck, tests in workerd including `voice/test/store-d1.test.ts` on a real D1). **Production voice is not redeployed by this row and stays on Postgres:** the owner deploys it by hand (`voice/README.md`), and at the cutover it needs `DB_TARGET` `d1`, `DEPLOY_ENV` not `production`, and the `DB` binding (the cutover row). Staging-only effect: the staging voice Worker reads the last D1 copy, `ai_providers` is held back from the copy so it finds no routed provider, and it holds no key, so it can never answer a call. Undo: revert the merge commit; the staging voice Worker can stay (it takes no calls) or be removed with `wrangler delete --env staging`.
- **Converted to D1: the desk assistant (playbooks, runs, run items, memory), OPS-142.** Every query on `agent_playbooks`, `agent_runs`, `agent_run_items` and `agent_memory` goes through `src/domain/agent/store.ts` (a Postgres adapter, today's queries and advisory-lock transactions moved as they were, and a D1 adapter, one chosen per request by `dbTarget()`): the run start and close, the run items, memory, the playbook versions and the stale-run sweep in `commands.ts`, and the context, run list, open flags and subject notes in `queries.ts`; production stays on Postgres. The caps are single conditional statements on D1 (`insert ... select ... where`), which replace the Postgres advisory locks: 100 items per run, one open flag per subject, 200 memory items and 5 per run, and the next playbook version, so two calls together at a cap give one row. Lookups into quotes, trips, the blog, the desk and the health snapshot stay on their own domains. Staging-only effects: `approvals.run_id` still points at Postgres `agent_runs`, so a proposal made during a staging run fails its Postgres foreign key until approvals move (OPS-150), and a run opened on staging with a staging-only API key follows the OPS-138 note above. The smoke prints `agent context lookup: 401 for a made-up key`; it checks the key sign-in on the agent route, and staging's `/api/health` reporting `d1 ok` is the evidence for the store. Undo on staging: set `DB_TARGET` back to `postgres` in `wrangler.jsonc` and redeploy staging.
- **Converted to D1: clients and memberships, OPS-149.** Every query on `members`, `memberships`, `reserve_transactions`, `member_preferences`, `member_lanes`, `companions` and `member_documents` outside the Stripe webhook and the invoice drawdown goes through `src/domain/members/store.ts` (a Postgres adapter and a D1 adapter, one chosen per request by `dbTarget()`): the admin client list and detail, the reserve ledger add, the client invite with its M code (one `db.batch` on D1, the counter upsert first), `getMemberByUserId` (every account page), the member tier sync, and the account Memberships, Members and Preferences pages and their actions. Production stays on Postgres. Staging-only effect: a member or user created in Postgres after the last D1 copy is not found on staging; the Stripe webhook still writes memberships and the reserve ledger on Postgres until the payments row, so a staging purchase or top-up is not seen on staging D1; inviting a brand new email on staging fails on the member insert, because `src/lib/auth-users.ts` still creates the `users` row on Postgres. D1 also gets the five money-path guard indexes of Postgres migration 0032, which OPS-100 left out, in D1 migration `0005_messy_doctor_octopus.sql`: `trips_quote_id_uniq`, `memberships_active_per_member_uniq`, `reserve_tx_top_up_per_intent_uniq`, `reserve_tx_refund_per_draw_uniq` and `schedule_blocks_hold_per_quote_aircraft_uniq`. The smoke prints `account sign-in redirect: ok` (GET /account with no cookie must redirect to the sign-in page), so staging and production can be compared. Undo on staging: set `DB_TARGET` back to `postgres` in `wrangler.jsonc` and redeploy staging; the indexes stay harmless (they only refuse rows Postgres also refuses).
- **Converted to D1: approvals (the assistant's proposals), OPS-150.** Every query on the `approvals` table goes through `src/domain/approvals/store.ts` (a Postgres adapter, today's queries moved as they were, and a D1 adapter, one chosen per request by `dbTarget()`): queueing a proposal (the stale twin, the one pending proposal per dedupe key, the per-run cap of 25 and the per-key cap of 40 in 24 hours), deciding one (the conditional claim `update ... where id and status = 'pending' returning`, so a proposal is approved once and only once, then the final write), the expiry sweep of the maintenance cron, the Needs your OK tab and the detail pages (the joined lists with the key's and the decider's name, the pending count, pending for a request or trip) and what was decided since a date for the assistant. The 24 hour window is a date the app computes (it was `now() - interval` on Postgres), and a duplicate insert is recognised on both databases by `src/db/unique.ts` (SQLSTATE 23505 or `UNIQUE constraint failed`; the messages store uses the same check). No D1 migration: the twin already has the partial unique index `approvals_pending_dedupe_uq`. The operation an approval carries out still runs through its own domain (`op.load`, `op.run`), so on staging a proposal about a request, trip or message still acts on Postgres until those rows move. Staging-only effects: a key, run or staff user created in Postgres after the last D1 copy fails the D1 foreign key when a proposal points at it, and the approver's name reads blank for a person not yet copied. Production stays on Postgres (the code refuses `d1` there). The smoke adds no check; staging's `/api/health` reporting `d1 ok` is the evidence. Undo on staging: set `DB_TARGET` back to `postgres` in `wrangler.jsonc` and redeploy staging.
- **Converted to D1: the public quote and the request page, OPS-153.** Every query of the quote wizard's submit (`src/app/quote/actions.ts`: the idempotency lookups, the quote with its JN code, any airport the picker has and the table lacks, the legs) and of the client's request page (`src/lib/request-page.ts` `loadRequestByToken`, `src/app/request/[token]/actions.ts` `chooseOption`: the token lookup, the option check, the claim) goes through `src/domain/quotes/store.ts` (a Postgres adapter, today's queries moved as they were, and a D1 adapter, one chosen per request by `dbTarget()`). On D1 the two transactions become atomic batches: the submit is the code counter upsert, the quote insert reading the counter in SQL (`codeSql`), one statement per airport and one per leg (D1 allows 100 bound values per statement); the client's pick is the conditional claim of the quote plus two statements guarded in SQL so they change nothing unless that very call made the claim. A second submit with the same idempotency key makes the batch fail whole (the counter number comes back) and the action returns the first quote, as on Postgres. D1 also gets the unique index Postgres has since migration 0021, `quotes_client_idempotency_key_uq` (where the key is not null), in D1 migration `0006_petite_epoch.sql`; the staging deploy applies it, and it fails loudly (and changes nothing) if staging D1 already holds two quotes with the same key, which the copy of Postgres data cannot produce because Postgres has the same index. Production stays on Postgres. Staging-only effect: a quote made on staging D1 is not seen by the desk's request commands, the SLA watch or the reports export until the next row of the move, and a signed-in visitor's member must exist in D1. The prod-smoke quote wizard spec prints `[prod-smoke] submitted JN-...`, so staging and production can be compared. Undo on staging: set `DB_TARGET` back to `postgres` in `wrangler.jsonc` and redeploy staging; the new index is harmless (drop it with `drop index quotes_client_idempotency_key_uq`).
- **Converted to D1: the desk's request reads, the SLA watch, the smoke prune and the reports export, OPS-154.** Every query of `listRequests` and `getRequest` (`src/domain/requests/queries.ts`: the request list with its search, legs and option counts, the one-request page's client roster, dispatchers, assignee, trips flown, holds, options and candidate aircraft), the SLA watch cron (`src/app/api/cron/sla-watch/route.ts`: the overdue claim and the due-soon list), the smoke prune (`src/domain/requests/prune-smoke.ts`, called by the api-maintenance cron) and the reports CSV export (`src/app/admin/settings/reports/export/route.ts`) goes through `src/domain/requests/store.ts` (a Postgres adapter, today's queries moved as they were, and a D1 adapter, one chosen per request by `dbTarget()`). On D1 `ilike` is `lower(x) like lower(?) escape '\'`, the snapshot is read with `json_extract`, the smoke test is `src/domain/smoke-d1.ts`, id lists are read in chunks of 50 (the helper moved to `src/db/d1/helpers.ts`), the SLA claim is one `update ... where id in (select ... limit n) returning`, and the prune is one atomic batch per 50 quotes whose statements each repeat the guard (smoke, older than 7 days, no trip), so a quote that got a trip meanwhile keeps its messages and itself. The export's window start is now a date (`periodStartDate`, UTC midnight) instead of a Postgres expression. No D1 migration. The desk's commands (status, assign, link a client, holds, options, send options) and convert to trip are the next rows (OPS-155 and the trips row), and still write to Postgres, so on staging a request the desk changes is not seen on D1 until then. Staging-only effects: a quote made on Postgres after the last D1 copy is not listed; the SLA watch, the prune and the export on staging read D1 only. Known difference, left as it was: the Postgres export drops a request with neither a first name nor an email (its smoke filter has no coalesce); the D1 export keeps it. Production stays on Postgres (the code refuses `d1` there). The smoke adds no check; staging's `/api/health` reporting `d1 ok` and `[prod-smoke] submitted JN-...` are the evidence. Undo on staging: set `DB_TARGET` back to `postgres` in `wrangler.jsonc` and redeploy staging.
- **Converted to D1: trips and the aircraft calendar, OPS-156.** Every query in `src/domain/trips/queries.ts` (`listTrips`, `getTrip`: the trip list with its search over the client's names and email, the member's names and the legs' cities, the legs, invoices and sourced options, and the one-trip page's client, invoice, request, aircraft, operator and chosen option), the trip lookups and the status write of `src/domain/trips/commands.ts` (`loadTripForMessage`, `loadTripForStatus`, `setTripStatus`'s trip update and its schedule block sync, and the client and itinerary reads behind the status notice), the manual blocks of `src/domain/schedule/commands.ts` (aircraft lookup, create, read, delete), the client's two trip pages (`src/app/account/trips/page.tsx` and `[id]/page.tsx`) and the aircraft page's block, recent-trip and total reads (`src/app/admin/aircraft/[id]/page.tsx`) goes through `src/domain/trips/store.ts` (a Postgres adapter, today's queries moved as they were, and a D1 adapter, one chosen per request by `dbTarget()`). On D1 `ilike` is `lower(x) like lower(?) escape '\'`, id lists are read in chunks of 50 and put back in SQL order, the aircraft totals have no `::int` cast, and the trip's calendar block is kept in step by `syncTripScheduleBlockD1` (the D1 twin of the Postgres function, same plan, same rows). The cancel refunds and the invoice editor of `trips/commands.ts` still wrote to Postgres here (they moved with OPS-161, below), and so did convert to trip (OPS-157, below): on staging a trip whose status is changed to cancelled refunds on Postgres, and a trip made by convert is not seen on D1 until its row. No D1 migration. Production stays on Postgres (the code refuses `d1` there). The Trip store tests step of CI runs the D1 adapter on a real SQLite; staging's `/api/health` reporting `d1 ok` and `[prod-smoke] submitted JN-...` are the evidence of the deploy. Undo on staging: set `DB_TARGET` back to `postgres` in `wrangler.jsonc` and redeploy staging.

- **Converted to D1: the desk's request commands, OPS-155.** Every query in `src/domain/requests/commands.ts` outside convert to trip (the loads and writes of status, the lookups behind thread and client messages, send options, assign, link a client, soft holds, options add, edit, choose and remove, and the operator lookup) and the one direct read in `src/app/admin/requests/[id]/actions.ts` (`quoteIdForOption`) goes through the request store of OPS-154, Postgres or D1 by `dbTarget()`. Results, messages, audit entries and mails are unchanged. On D1 the two multi-statement writes are one `db.batch` each (D1 runs a batch as one transaction): `chooseOption` (clear the request's chosen options, choose one) and `markOptionsSent` (the options in chunks of 50 ids, then the request's move to `options_sent`). That move now carries its status condition in the WHERE (`status in ('submitted','triaged','sourcing')`) on both databases, instead of a status read earlier in the app, so a request that moved on in between is never pulled back; on Postgres it gives the same result as before. A duplicate soft hold (the unique index `schedule_blocks_hold_per_quote_aircraft_uniq`) is thrown by the store as `HoldTaken` on both sides and answered with the same words as before. The hold's leg dates sort NULL last on D1 (SQLite sorts NULL first, Postgres last). The operator lookup is `lower(name) like lower(?) escape '\'` with the caller's `%text%` pattern, not escaped, as on Postgres. No D1 migration. Convert to trip (trip, legs, invoice, drawdown) still writes to Postgres and goes with the trips and invoices rows. Production stays on Postgres (the code refuses `d1` there). Undo on staging: set `DB_TARGET` back to `postgres` in `wrangler.jsonc` and redeploy staging.
- **Converted to D1: convert a request to a trip, OPS-157.** `loadRequestForConvert` and `convertRequestToTrip` (`src/domain/requests/commands.ts`) read through `src/domain/requests/store.ts` (the request, its legs, the chosen option, the aircraft by tail, the client's name) and write through its `convertToTrip` (a Postgres adapter, today's transaction moved as it was with `attemptInvoiceDrawdown` and its advisory lock, and a D1 adapter). On D1 the whole convert is one `db.batch`, which D1 runs as one transaction: the trip counter, the trip (code read in SQL by `codeSql`), one insert per leg, the aircraft's calendar block when the legs give one (decided by `planScheduleBlock` before the batch), the invoice counter, the invoice (`due` when a draw is tried, else `draft`), the reserve draw, the invoice turned `paid`, the revert to `draft` when nothing was drawn, the request's soft holds deleted, the request marked `converted`. There is no lock on D1: D1 runs one batch at a time per database, and the draw is one `insert ... select` that writes only when the member has an active membership (the newest activated) and the ledger's balance still covers the total, so two converts of one member cannot both draw; the invoice turns paid only if that draw row exists. A second convert of the same request fails on the unique index `trips_quote_id_uniq` (`UNIQUE constraint failed`, read by `src/db/unique.ts`) and the batch rolls back, the code counters included. `src/lib/membership-balance.ts` is unchanged and is called by the Postgres adapter only. The booking mail's reads no longer touch the database (the legs are the ones the load read, the address comes from the store). No D1 migration. Production stays on Postgres (the code refuses `d1` there). The `Request store tests` step of CI runs the convert cases on a real SQLite. Undo on staging: set `DB_TARGET` back to `postgres` in `wrangler.jsonc` and redeploy staging.
- **Converted to D1: invoices outside the Stripe webhook, OPS-161.** The cancel refunds and the invoice editor of `src/domain/trips/commands.ts` (`refundChartDrawsForTrip`, `refundCardPaymentsForTrip`, `loadInvoiceForUpdate`, `updateInvoice`, the last `db` sites of that file), the invoice watch cron (`src/app/api/cron/invoice-watch/route.ts`), and the client's invoice page and pay button (`src/app/account/invoices/page.tsx` and `actions.ts`) go through `src/domain/invoices/store.ts` (a Postgres adapter, today's queries moved as they were, and a D1 adapter, one chosen per request by `dbTarget()`). On D1 the reserve refunds of a cancel are one `db.batch` (the refund inserts, then the invoices voided with the note on a new line), guarded by the unique index `reserve_tx_refund_per_draw_uniq`: a racing cancel makes an insert fail with `UNIQUE constraint failed`, read by `src/db/unique.ts`, and the batch rolls back. The two claims of the invoice watch are one `update ... where id in (select ... limit ?) returning` each, with the UTC day passed in by the route (Postgres reads `current_date`); the Checkout claim compares `updated_at` to the instant 30 minutes ago that the page passes (`CHECKOUT_CLAIM_TTL_MS`). D1 migration `0007` adds the two partial unique indexes Postgres has had on invoices since migration 0027 (`invoices_stripe_payment_intent_uq`, `invoices_stripe_checkout_session_uq`: one Stripe payment and one Checkout session per invoice). Production stays on Postgres. The Stripe webhook follows in OPS-162. Undo on staging: set `DB_TARGET` back to `postgres` in `wrangler.jsonc` and redeploy staging; the two indexes are harmless and can be dropped with `drop index invoices_stripe_payment_intent_uq` and `drop index invoices_stripe_checkout_session_uq`.
- **Converted to D1: the Stripe webhook, OPS-162.** Every query of `src/app/api/stripe/webhook/route.ts` goes through `src/domain/payments/store.ts` (a Postgres adapter, today's queries moved as they were, and a D1 adapter, one chosen per request by `dbTarget()`): the event claim (`insert ... on conflict do nothing returning`), the processed and error stamps, the membership reads, the reserve credit, the invoice turned paid, the invoice behind a failed payment, the membership activation and the void on a full refund. The client's email and the trip code for the mails come from the invoice store (OPS-161). On D1 the activation is one `db.batch` (D1 runs a batch as one transaction): the membership turned active with the Stripe ids, then the member's tier from the program (`PROGRAM_TO_TIER`) and `tier_since` from the membership's own `activated_on`, only while that membership is active. A unique violation in the first statement (a second active membership for the member, or a Checkout session or payment already used by another membership) rolls the tier back with it, as the Postgres transaction does on 23505; every `code === "23505"` test of the route is now `isUniqueViolation`, which reads both databases. `paid_on` on D1 is the UTC day worked out in the app (Postgres reads `current_date`). D1 migration `0008` adds the two partial unique indexes Postgres has had on memberships since migration 0030 (`memberships_stripe_session_uq`, `memberships_stripe_pi_uq`: one Checkout session and one payment per membership). Staging effect: with `d1` a Stripe test event is applied to the D1 database only. Production stays on Postgres (the code refuses `d1` there). Undo on staging: set `DB_TARGET` back to `postgres` in `wrangler.jsonc` and redeploy staging; the two indexes are harmless and can be dropped with `drop index memberships_stripe_session_uq` and `drop index memberships_stripe_pi_uq`.
- **Converted to D1: the desk's counts, the assistant's desk snapshot, the Reports summary and the 7 AM morning summary, OPS-163.** Every query in `src/domain/desk/queries.ts` (the sidebar's submitted count read on every admin page, and `deskSnapshot` behind `GET /api/v1/desk/snapshot`: the five quote counts, the overdue invoices and the live empty legs), `src/domain/reports/queries.ts` (Settings, Reports and `GET /api/v1/reports/summary`: the request counts, the money summary and the most overdue invoice) and `src/app/api/cron/morning-summary/route.ts` (today's flights and the open requests) goes through `src/domain/reports/store.ts` (a Postgres adapter, today's SQL moved as it was, and a D1 adapter, one chosen per request by `dbTarget()`). Nothing is written. On D1 each `count(*) filter (...)` is `count(case when ... then 1 end)` and each filtered sum is `sum(case ...)`; the time windows are worked out once in the app (`periodStartDate` and the new `periodPrevStartDate` in `period.ts`, UTC midnights, the day `current_date - n` gives on a UTC Postgres) and passed as milliseconds for quotes and as `YYYY-MM-DD` text for invoices; days late is a `julianday` difference with today passed in; the smoke filter is `src/domain/smoke-d1.ts`; the client's name on the morning summary is read with `json_extract`; flights sort an untimed leg last through an explicit `is null` key. The Postgres adapter ignores the dates the interface passes and keeps `current_date`, `date_trunc` and `ilike`. No D1 migration. Production stays on Postgres (the code refuses `d1` there). The `Report store tests` step of CI runs the D1 adapter on a real SQLite. Undo on staging: set `DB_TARGET` back to `postgres` in `wrangler.jsonc` and redeploy staging.

## 9. Custom domain

`jetnine.com` and `www` are custom domains of the edge cache Worker (see §2 → Cutover and Edge cache Worker), and Cloudflare issues their certificates.

`NEXT_PUBLIC_SITE_URL` comes from the `wrangler.jsonc` vars at runtime and from the deploy workflow at build time. The sitemap, OG URLs, Stripe redirects and canonical tags all use it.

## Trigger logic made by the app (OPS-102)

Three more Postgres triggers have an app-side twin, so the rule holds on D1 too. The triggers stay in place on Postgres until the cutover (their removal needs the owner's yes and the exact statement); each app function recomputes from the current rows, so running beside the trigger arrives at the same values.

- **Aircraft calendar.** `syncTripScheduleBlock(tx, tripId)` in `src/domain/trips/schedule-block.ts`, after a trip is converted (`src/domain/requests/commands.ts`, after its legs are inserted) and after a status change (`src/domain/trips/commands.ts`). Same window rules as `trips_sync_schedule_block`: wheels up, else the earliest leg departure (a date alone is 00:00 UTC); wheels down, else the ETA, else the latest leg arrival; no aircraft, no window or a cancelled trip means no block.
- **Member tier.** `syncMemberTier(tx, membershipId, previousStatus)` in `src/domain/memberships/tier.ts`, after each membership write (`src/app/account/memberships/actions.ts`, and the Stripe webhook, in one transaction with the activation). An active membership sets the tier from its program and tier_since from activated_on; losing the last active one resets the tier to on_demand.
- **Role lock.** `setUserRole(actorRole, ...)` in `src/lib/auth-users.ts` refuses a role change unless the actor is an admin or superadmin (`src/lib/role-lock.ts`). The only caller is `src/domain/team/commands.ts`.
- Tests: CI step "Trigger-logic tests".

## First-deploy verification checklist

After everything is wired, the fastest single-call check is:

```
curl -s https://YOUR_DOMAIN/api/health | jq
```

Expected response shape:

```json
{
  "ok": true,
  "status": "healthy",       // or "degraded" if some optional integration is unconfigured
  "env": "production",
  "region": "cloudflare",
  "sha": "abc123def456",
  "checks": {
    "db":        { "ok": true,  "latencyMs": 12 },
    "stripe":    { "ok": true,  "configured": true, "webhookConfigured": true, "mode": "live" },
    "email":     { "ok": true,  "provider": "resend", "outboundConfigured": true, "inboundConfigured": true, "fromConfigured": true },
    "twilio":    { "ok": true,  "smsConfigured": true, "whatsappConfigured": true },
    "sentry":    { "ok": true,  "browserConfigured": true, "serverConfigured": true },
    "posthog":   { "ok": true,  "configured": true }
  }
}
```

`status: "healthy"` means every integration is wired. `status: "degraded"` means DB is up but at least one optional integration (Stripe / email / Twilio / Sentry) is unconfigured — read `checks` to see which. HTTP status is 200 unless the DB itself is unreachable, in which case the endpoint returns 503 with the same body shape (so ops still has diagnostics).

For broader verification, also check:

- [ ] `/sitemap.xml` returns 200 with the right host in `<loc>` entries.
- [ ] `/robots.txt` shows production rules (not `Disallow: /`).
- [ ] `/opengraph-image` returns a 200 PNG (1200×630).
- [ ] Security headers present: `curl -sI YOUR_DOMAIN | grep -i 'csp\|hsts\|frame-options'`.
- [ ] `/quote` form submits; new-quote email lands at `DISPATCH_NOTIFY_EMAIL`; row appears in `/admin/dispatch`.
- [ ] `/account/invoices` Pay-now → Stripe Checkout → return → invoice flips to `paid` (test mode).
- [ ] `/account/memberships` Activate Card · 100 → Stripe Checkout → return → membership active + balance shows $100k.
- [ ] Flip a test trip from `confirmed` → `boarding`; member receives both email + SMS.
- [ ] Member replies to either; thread shows `direction='in'` row.
- [ ] PostHog activity feed shows pageviews.
- [ ] Sentry dashboard shows a test error (trigger via `/admin/audit` if you've wired one).

## Diagnosing a sick deploy

If `/api/health` returns `status: "unhealthy"`, the only check that can flip it is `db`. Three causes, in order of likelihood:

1. **Hyperdrive is misconfigured.** On Workers, the app connects through the `HYPERDRIVE` binding, not `DATABASE_URL`. If the Supabase password was rotated:
   - Run `pnpm exec wrangler hyperdrive update <HYPERDRIVE_ID> --origin-password=NEW`.
   - Also update the `DATABASE_URL` and `DIRECT_URL` secrets. Scripts, migrations and `pnpm dev` still use them.
2. **Supabase project paused.** Free tier auto-pauses after 7 days of zero queries. Resume from the Supabase dashboard; deploys start working again within seconds.
3. **Hyperdrive points at the wrong pooler.** It must use the **session pooler**: port 5432 on `aws-1-us-east-2.pooler.supabase.com`. `DATABASE_URL`, which is used outside Workers, stays on the transaction pooler URL (port 6543).

If `/api/health` returns `status: "degraded"`, the DB is fine but at least one optional integration (Stripe / email / Twilio / Sentry / PostHog) is unconfigured. Visit `/admin/health` for a per-integration breakdown with fix hints, or read `checks.*` in the JSON.

The post-deploy smoke workflow (`.github/workflows/smoke-after-deploy.yml`) fails when `/api/health` returns non-200 against a non-localhost target — so a degraded prod deploy will paint the merge commit red without manual checking. Between deploys the monitor Worker (`monitor/`) checks every 15 minutes; the scheduled `.github/workflows/health-monitor.yml` reads its `/status` once a day and can probe `/api/health` on a run by hand.

## After a deploy: retries and the tail summary (OPS-104)

Requests were cut off a few minutes after some production deploys, and the same read passed minutes later. The cause is not yet read from evidence, so a deploy run now records it instead of guessing.

- **Smoke and sitemap reads name their cause.** When a read throws, the smoke line carries the reason (`UND_ERR_SOCKET`, `ECONNRESET`, a timeout, a cut body) and how long it took, plus the `cf-ray` and edge cache state of the latest response. The sitemap audit names the URL and the exception type of every error (for example `https://jetnine.com/blog/x: IncompleteRead(26647 bytes read)`).
- **One retry, transport errors only.** A GET or HEAD that fails because the connection was reset or closed, the body was cut off or the 15 s timeout fired is tried once more after 10 s (`SMOKE_RETRY_DELAY_MS`, `SITEMAP_RETRY_DELAY`). A wrong status, a wrong redirect, a missing string or a wrong header is never retried and fails at once. A read that fails twice fails the job.
- **A retry is a warning to look at, not a pass to ignore.** Every first failure is a `::warning` annotation on the run with URL, cause, `cf-ray` and time, and the run ends with "N reads needed a retry". If the same URL needs a retry after several deploys, treat it as a real cut-off for visitors.
- **The `tail` job.** After the app deploy, `tail` in `deploy-cloudflare.yml` runs `wrangler tail` on the edge and app Workers (the `-staging` names on staging) for up to 6 minutes, or until the smoke and sitemap jobs are done. Its job summary and the artifact `deploy-tail-summary` list, per Worker, every event whose outcome is not `ok` (exception, exceededCpu, exceededMemory, canceled, responseStreamDisconnected) with time, method, path without query string and the exception name. Tokens and ids in paths are masked. It never prints headers, query strings, bodies, log lines or exception messages, and the raw tail is not uploaded. It uses the repo's own deploy token; if that cannot tail, the summary says so in one line and the job passes. The job never fails a deploy.
- **The summary says how many events it read.** Each Worker block starts with "Events read: N". `wrangler tail --format json` prints every event as indented JSON over many lines, so the summary reads a stream of JSON objects, not one object per line. "0 not ok" next to "Events read: 0" means the tail saw nothing, not that all was well; check the attach time and that the smoke job sent requests in the window.
- **Reading the summary.** Compare its times with the smoke and sitemap jobs of the same run. Non-ok outcomes on visitor paths (exceededCpu, exceededMemory, responseStreamDisconnected, exceptions on pages) are a real fault to file with that evidence. Retries in the checks and nothing in the tail point at the checks racing the rollout. The tail attaches after the deploy job ends, so the first seconds of the new version can fall before it; its summary prints when it attached.
- **Staging robots.** The smoke check holds staging to the same rule as previews (`Disallow: /` and no `Sitemap:` line), matching `src/app/robots.ts`. Production is still held to the production rule.

- **The `warm` job (OPS-175).** After the app deploy and before `smoke` and `sitemap`, `warm` in `deploy-cloudflare.yml` runs `node scripts/deploy-warm/warm.mjs <url>`: it requests `/`, `/contact`, `/cost-calculator` and `/api/health` of the target (a read every 5 s, `cache-control: no-cache`, redirects not followed) until each answers 200 three times in a row, and `/api/health` must also say `ok: true`. One line per page: `warm: /contact 200 x3 after 2 tries (1.4 s)`, or `WARM FAIL: /contact last status 500 after 35 tries` with exit 1 after 180 s. `smoke` and `sitemap` need `warm`, so a deploy that serves 500s near the runner is red and its smoke never starts. It reads only the data centre nearest the runner, so a pass does not prove every data centre. `tail`, `monitor` and `voice-staging` still start right after `deploy`. No secret, and nothing but a status label is printed. Way back: revert the change; `smoke` and `sitemap` go back to `needs: deploy`.

Tests: `pnpm exec tsx --test scripts/smoke-fetch.test.mts`, `node --test scripts/deploy-tail/summarize.test.mjs`, `node --test scripts/deploy-warm/warm.test.mjs`, `python3 scripts/test-live-sitemap.py`.

## Codes and timestamps made by the app (OPS-101)

D1 cannot run Postgres triggers, so the work of two kinds of trigger now happens in the app, and the triggers stay in place on Postgres until the cutover (their removal needs the owner's yes and the exact statement).

- **Codes.** `nextCode(tx, kind)` in `src/db/codes.ts` makes JN-YYYY-NNNNN (quote), JN-YYYY-NNNN (trip), INV-YYYY-NNNN, EL-YYYY-NNNN and M-YYYY-NNNN with one upsert on the `[kind]_code_sequence` table (`insert ... on conflict (year) do update set last_value = last_value + 1 returning last_value`). The year is UTC. The five insert paths call it in the same transaction as the insert: `src/app/quote/actions.ts`, `src/domain/requests/commands.ts` (trip and invoice), `src/domain/clients/commands.ts`, `src/domain/empty-legs/commands.ts`. The triggers fill a code only when it is empty, so they do nothing now and the counter moves once.
- **updated_at.** The 14 tables that had the `set_updated_at` trigger (aircraft, airports, aircraft_schedule_blocks, empty_legs, fbos, invoices, member_preferences, members, memberships, operators, quotes, staff, trips, users) carry `$onUpdate(() => new Date())`. On Postgres the trigger then sets the same value in the same write.
- Still to move: the schedule-block and member-tier syncs and the role lock (OPS-102), the new-user trigger (OPS-94). Row level security and its helper functions are not moved: D1 has none, and the app's own checks guard the data.
- Tests: `src/db/codes.test.ts` (CI step "Codes and updated-at tests").

## Rotation

If you need to rotate a secret:

1. Generate the new value in the provider's dashboard.
2. Run `pnpm exec wrangler secret put NAME` (add `--env staging` for staging). Workers use the new value from the next request on, with no redeploy.
3. `NEXT_PUBLIC_*` values are the exception, because they're compiled into the build. Change the GitHub variable and redeploy.
4. Revoke the old value in the provider.

## D1 tables (OPS-100)

The 50 tables of `src/db/schema` are written a second time for Cloudflare D1 (SQLite) in `src/db/d1/schema`, one file per Postgres file, same export, table and column names. Nothing live reads them yet; later rows convert the data code one domain at a time. OPS-129 adds four D1 tables with no Drizzle twin on Postgres (the voice call log, created there by raw SQL in migration 0038): `voice_leads`, `voice_calls`, `voice_trip_requests`, `voice_messages` in `src/db/d1/schema/voice-calls.ts`, named in `RAW_SQL_ON_POSTGRES` in the parity test. The D1 schema now holds 57 tables.

How types map, decided once:

- `uuid` is `text`, made in the app (`newId`). `timestamp` is `integer` in `timestamp_ms` mode: UTC milliseconds, read back as `Date`. `date` and `time` are `text` (`YYYY-MM-DD`, `HH:MM:SS`); `numeric` is `text`, so decimals stay exact strings. `boolean` is `integer` in `boolean` mode. `jsonb` and `text[]` are `text` holding JSON. `char(n)` is `text` plus a length CHECK.
- A Postgres enum is `text` with the same values (read from the Postgres enum, so there is one list) plus a CHECK named `<table>_<column>_enum` (`enumCheck` in `src/db/d1/helpers.ts`).
- Defaults that Postgres ran in the database (`now()`, `current_date`, `gen_random_uuid()`, `encode(gen_random_bytes(24), 'hex')`, `now() + interval`) run in the app (`src/db/d1/helpers.ts`). Raw SQL inserts no longer get them.
- No equal in D1: the `auth` schema (so `users.id` has no foreign key), row level security, and Postgres functions and triggers (OPS-101). `api_keys` scope CHECKs are rewritten with string tests because SQLite forbids subqueries in CHECK.
- Regenerate with `pnpm db:d1:generate` (`drizzle.d1.config.ts`); the migration goes to `src/db/d1/migrations` and the staging deploy applies it. The test `src/db/d1/parity.test.ts` runs in CI and fails when a Postgres table, column, not-null flag, primary key, foreign key count, index count or enum CHECK has no D1 twin.


## Copy Postgres to staging D1 (OPS-105)

Step 5 of the move to Cloudflare (OPS-93): fill staging's own D1 database from Postgres and prove the copy is whole. Production's database is never written.

- Run the GitHub workflow **D1 copy** by hand (Actions, Run workflow). `mode = load` applies the D1 migrations, wipes the staging D1 tables, copies all 57 tables (51 at OPS-105, then the 6 added since, four of them the voice tables of OPS-129; the held-back ones are loaded empty) and then checks; `mode = check` only compares. It uses the repo secrets `DATABASE_URL`, `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
- Postgres is read in one read-only snapshot, so every table comes from the same moment. Values are mapped by the rules in "D1 tables (OPS-100)" above (`scripts/d1-copy/map.mjs`).
- The log has one line per table: Postgres rows, D1 rows, and "checksum equal yes or no". The checksum is an order-independent hash of each row's key and its `updated_at` (or `created_at`). No row value is printed, and wrangler's own text is not echoed. A failure prints an error code only.
- The tool refuses any target other than the database `jetnine-staging` with `--env staging`; the guard runs before any call. `pnpm exec tsx scripts/d1-copy/copy.mjs --list` prints the table plan with no network.
- **Held back on purpose:** `user_credentials` (password hashes), `user_sessions` (session token hashes), `api_keys` (key hashes) and `ai_providers` (encrypted provider keys). These are not copied to staging. Moving credentials is the owner's decision and belongs to the cutover row.
- Staging D1 is a test copy, not a source of truth. Run the copy again whenever a fresh copy is needed; it starts by wiping.
- The reverse copy (D1 back to Postgres, for a rollback) is not part of this row.
- Tests (`scripts/d1-copy/*.test.*`) run in CI and need no secrets or network.

### Load order, nulled references and the preflight (OPS-115)

The first load failed with `SQLITE_CONSTRAINT` and the log did not say where. What changed:

- **Parents first.** The table plan is in referential order (a parent table before every table that has a foreign key to it, ties by name). The file deletes children first (the plan in reverse) and inserts parents first. `--list` prints this order. If the keys ever form a cycle, the plan throws and names the tables.
- **Five references are written as NULL.** `agent_runs.key_id`, `api_requests.key_id` and `approvals.requested_by_key` point to `api_keys`; `ai_routes.primary_provider_id` and `ai_routes.fallback_provider_id` point to `ai_providers`. Both parents are held back and load empty, so a real value would break the key. All five columns are nullable (the plan throws if one ever is not, and then that table would have to be held back too, which is the owner's call). The log says how many rows had such a reference set to null, per table.
- **Preflight, before staging is touched.** The tool builds an in-memory SQLite database from the repo's own D1 migrations (Node's built-in `node:sqlite`), loads every table's rows into it with foreign keys off, then runs `PRAGMA foreign_key_check`. A rule the real data does not meet is printed as `preflight FAIL [table]: [kind and names]` (for example `UNIQUE members.email`, `NOT NULL quotes.total`, `CHECK agent_memory_kind_check`, or `FOREIGN KEY child -> parent: 2 rows`), followed by `staging D1 not touched`, and the run exits 1. A statement longer than D1's 100,000 bytes is reported the same way. Only table, column and constraint names are printed, never a value. If `node:sqlite` is missing the preflight cannot run and the run stops, also before staging is touched.
- **Clean preflight** prints `preflight ok: [n] tables, [rows] rows; ...` and the remote load follows as before.
- **If the remote load still fails** the log prints the error code with the constraint kind and names, then counts the rows of every table in staging D1: `staging D1 after the failed load: empty` or `partial, [x] of [n] tables have rows (a new load wipes it first)`. Running the load again is always safe.
- Nothing else changed: the staging-only guard, the held-back tables (never read from Postgres), no row value in any log line.
