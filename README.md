# JetNine Web

Full-stack rebuild of jetnine.com — marketing site, four-step quote wizard, member account, and dispatcher admin app. Next.js 15 + Supabase + Drizzle on Vercel.

— Repo: [`AlwayzLegit/JetNine-Website`](https://github.com/AlwayzLegit/JetNine-Website)
— Live database: Supabase project `szuztxfhkudcjzhrkfld`, Postgres 17.6
— Auth: Supabase magic-link, role-gated via middleware
— Deploy: Vercel, auto-deploy on push to `main`

---

## What's in the box

**20 tables · 20 migrations · 23 routes**

| Surface | Routes |
|---|---|
| Marketing | `/`, `/aircraft` + 6 categories, `/memberships`, `/empty-legs`, `/how-it-works`, `/safety`, `/about`, `/contact`, `/faq`, `/legal` |
| Quote wizard | `/quote/mission`, `/quote/aircraft`, `/quote/contact`, `/quote/review` |
| Auth | `/sign-in`, `/auth/callback` |
| Member account | `/account`, `/account/trips` + `[id]`, `/account/invoices`, `/account/preferences`, `/account/members` |
| Admin dispatch | `/admin/dispatch`, `/admin/quote/[id]`, `/admin/trip` + `[id]`, `/admin/operators`, `/admin/aircraft`, `/admin/member` + `[id]`, `/admin/empty-leg`, `/admin/reports`, `/admin/audit` |

**Data model** lives in [`src/db/schema/`](./src/db/schema). Migrations in [`src/db/migrations/`](./src/db/migrations). Server Actions for every state-changing operation are colocated with their routes (e.g. [`src/app/admin/quote/[id]/actions.ts`](./src/app/admin/quote/[id]/actions.ts)). Every action logs to `audit_log` via [`src/lib/audit.ts`](./src/lib/audit.ts).

---

## Stack

- **Frontend + Backend:** Next.js 15 (App Router), React 19, TypeScript, Tailwind 3
- **Database + Auth + Storage:** Supabase (Postgres 17 + Row-Level Security + magic-link OTP)
- **ORM:** Drizzle (typed, lightweight, plays with the Supabase pooler)
- **Forms:** native HTML + Server Actions; client state via Zustand for the quote wizard
- **Fonts:** Fraunces (display serif), Inter (UI sans), JetBrains Mono (operations type)
- **Hosting:** Vercel
- **Package manager:** pnpm

---

## Local development

```sh
pnpm install
cp .env.example .env.local       # then fill in real Supabase keys
pnpm dev                         # http://localhost:3000
```

The dev server is `next dev --turbopack`. Hot-reload covers everything including Server Actions.

### Env vars (`.env.local`)

| Name | Purpose | Where to find |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | Supabase dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-safe key (RLS-respecting) | same screen |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only bypass key — keep secret | same screen (reveal) |
| `DATABASE_URL` | Pooled connection (port 6543, transaction mode) | Project Settings → Database → Connection string |
| `DIRECT_URL` | Session connection (port 5432) — used by Drizzle CLI | same screen, session mode |
| `RESEND_API_KEY` *(optional)* | Resend API key — transactional email | resend.com → Dashboard → API Keys |
| `POSTMARK_SERVER_TOKEN` *(optional)* | Alternative to Resend | postmarkapp.com → Servers → API Tokens |
| `EMAIL_FROM` *(optional)* | Sender address, e.g. `JetNine <dispatch@jetnine.com>` | own choice; must be a verified sender |
| `DISPATCH_NOTIFY_EMAIL` *(optional)* | Inbox that receives new-quote alerts; defaults to `dispatch@jetnine.com` | own choice |
| `NEXT_PUBLIC_SITE_URL` *(optional)* | Used to build absolute links in emails (workbench URL); falls back to request headers | e.g. `https://jetnine.com` |

URL-encode any special characters in passwords (`#` → `%23`).

**Email-on-submit is wired but ships dark.** Without `RESEND_API_KEY` or `POSTMARK_SERVER_TOKEN`, every send call logs the would-be payload to stdout and resolves successfully — so the rest of the app behaves as if email were configured. Drop a key in and acknowledgments + dispatch notifications start flowing on the next deploy.

---

## First-time setup

### 1. Bootstrap an admin

Magic-link auth creates a `public.users` row on first sign-in with `role='member'`. To self-promote the first admin, set a Postgres GUC once via the Supabase SQL editor:

```sql
alter database postgres
  set jn.admin_bootstrap_email = 'you@example.com';
```

Then sign in at `/sign-in` with that email. The `handle_new_auth_user` trigger sees the match and assigns `role='admin'`. After the first admin exists, you can promote others by hand:

```sql
update public.users set role = 'admin' where email = 'them@example.com';
```

If you signed in **before** setting the GUC, run that same update statement to fix yourself.

### 2. Vercel env vars

Settings → Environment Variables → add the same five env vars from `.env.local` to **Production, Preview, and Development** scopes. The deployed site renders without them but every Supabase call fails until they're set.

### 3. Onboard members

`public.users` is created automatically on auth signup; `public.members` carries tier + member_code and is created by ops. Two paths:

**Recommended — admin UI.** Sign in as admin, hit `/admin/member` → **+ Invite member**. The form sends a magic-link invite via Supabase admin API, creates the `public.members` row, fills in the `M-YYYY-NNNN` code, and audit-logs the action. Reuses existing auth users if the email already signed in once.

**Fallback — SQL.** If the admin UI isn't reachable for some reason:

```sql
insert into public.members (user_id, member_code, status)
values ('<auth.users.id>', '', 'active'); -- code auto-fills via trigger
```

Every member-facing page handles "no member yet" gracefully and points the user at `/quote`.

---

## Migrations

Drizzle schema in `src/db/schema/` is the source of truth. Two flavors of migration in `src/db/migrations/`:

- **Drizzle-generated** (`0000_*`, `0002_*`, etc.) — emitted from schema by `pnpm db:generate`.
- **Hand-written** (`0001_rls_and_auth_triggers.sql`, `0003_quotes_rls_and_codegen.sql`, etc.) — for RLS policies, code-generation triggers, seed data, anything Drizzle doesn't model. Manually registered in `meta/_journal.json`.

Workflow:

```sh
# 1. Edit src/db/schema/*.ts
pnpm db:generate --name your_migration_name

# 2. Optionally write a hand-rolled SQL alongside (RLS, triggers, seeds)
#    and add it to meta/_journal.json manually.

# 3. Apply
pnpm db:migrate

# Optional: visual schema explorer
pnpm db:studio
```

Or just push the schema diff straight without generating a file (dev only):

```sh
pnpm db:push
```

---

## Observability

`src/instrumentation.ts` is the Next.js runtime hook. Currently logs startup + request errors to stdout (visible in Vercel Function Logs). To wire Sentry:

```sh
pnpm add @sentry/nextjs
```

then add `SENTRY_DSN` to env and uncomment the two Sentry blocks in `src/instrumentation.ts`.

---

## Audit log

Every state-changing Server Action calls `logAudit({...})` from `src/lib/audit.ts`. Read via `/admin/audit` (staff only). Schema:

| Column | Type | Notes |
|---|---|---|
| `action` | text | dotted namespace, e.g. `quote.status.update`, `trip.create.from_quote` |
| `subject_type` | enum | `quote / trip / invoice / member / membership / reserve_transaction / operator / aircraft / empty_leg / empty_leg_watchlist / preferences / user_role / system` |
| `subject_id` | uuid | nullable for system events |
| `subject_code` | text | human ref cache (`JN-2026-NNNN`, etc.) |
| `diff` | jsonb | `{field: {before, after}}` |
| `metadata` | jsonb | free-form context |
| `ip`, `user_agent` | text | from request headers, for dispute arbitration |

Append-only. No `UPDATE` / `DELETE` policies on the table.

---

## Project layout

```
src/
├── app/
│   ├── (marketing)/        # 16 public pages with shared SiteNav + SiteFooter
│   ├── (auth)/sign-in/     # magic-link form + Server Action
│   ├── account/            # member-only routes, gated by middleware
│   ├── admin/              # staff-only routes, gated by middleware + requireStaff()
│   ├── quote/              # 4-step wizard with Zustand sessionStorage
│   ├── auth/callback/      # Supabase OAuth code → session exchange
│   └── globals.css         # design tokens + component primitives
├── components/             # shared and per-feature UI
├── db/
│   ├── schema/             # Drizzle table definitions (17 files)
│   └── migrations/         # SQL files + meta/_journal.json
├── lib/
│   ├── auth.ts             # getCurrentUser / requireUser / requireStaff
│   ├── audit.ts            # logAudit helper
│   ├── supabase/           # server / browser / middleware Supabase clients
│   ├── airports.ts         # 43-airport catalog for the wizard autocomplete
│   ├── fleet.ts            # aircraft category catalog (becomes DB-backed later)
│   ├── empty-legs.ts       # marketing-board view-model types
│   ├── member.ts           # getMemberByUserId
│   ├── quote-pricing.ts    # indicative pricing math
│   └── quote-store.ts      # Zustand store for the wizard
├── middleware.ts           # Supabase session refresh + role gates
└── instrumentation.ts      # Next.js runtime hook (stdout logging + Sentry stub)
```

---

## Phases shipped

- ✅ **Phase A.1** — users / members / staff / dispatcher_assignments + RLS + auth triggers
- ✅ **Phase A.2** — member_preferences / lanes / companions / member_documents
- ✅ **Phase B.1** — operators / operator_contacts / aircraft (with 12 + 18 seed rows)
- ✅ **Phase C.1** — quotes / quote_legs
- ✅ **Phase C.2** — trips / trip_legs / invoices + quote→trip conversion
- ✅ **Phase C.3** — empty_legs / empty_leg_watchlists (6 seed rows on the live board)
- ✅ **Phase C.4** — memberships / reserve_transactions ledger + members.tier sync trigger
- ✅ **Phase C.5** — audit_log / messages
- ✅ **Phase B.2** — aircraft_schedule_blocks + trip-sync trigger + 14-day planner at `/admin/ops`; airports + fbos catalog seeded from the 43-airport network

**Pending:**
- Tighten ICAO columns on `quote_legs` / `trip_legs` / `empty_legs` / `aircraft_schedule_blocks` to FK `airports.icao` once the catalog grows past the seed
- Sentry (drop a DSN → uncomment two blocks in `instrumentation.ts`)
- Live aircraft tracking — needs FlightAware / ADS-B Exchange API access
- Inbound message webhooks (Twilio / Postmark) — turn `direction='in'` into real round-trip threading

---

## Conventions

- **No clarifying questions during build sessions.** Reasonable defaults documented in [`memory/jetnine-open-questions.md`](./memory) — challenge them in PR review.
- **No emojis in code or commit messages** unless asked.
- **Co-author trailer** on every commit so historical work is attributable.
- **One concept per file.** If a Drizzle schema crosses 200 lines, split it.
- **Tailwind utility-first.** Component primitives in `globals.css` (`.btn`, `.field-jn`, `.caption`, etc.) for things that recur across pages.

---

## Part 295 disclosure (operator-facing)

JetNine LLC is an **indirect air carrier registered under 14 CFR Part 295** with the U.S. DOT. Every flight is operated by an independent FAA Part 135 certificated direct air carrier. JetNine sources, contracts, and coordinates — it does not operate aircraft, employ crew, or hold a Part 135 certificate. The Part 295 disclosure appears on every charter agreement and on `/legal` of the public site.

This codebase is built to be audit-compliant — every operational state change is captured in `audit_log` with the actor, diff, IP, and user-agent for dispute arbitration.
