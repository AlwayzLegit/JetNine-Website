# Light redesign — status and handoff (2026-10-06)

Branch `light-redesign`. Not merged; `main` (live) is unchanged.
Source: Claude Design project "Jetnine Redesign", `Light - *.dc.html` screens
(handoff zip kept outside the repo).

## What is done
Every screen in the handoff is ported, one commit per area:
light tokens + header/footer + Home; shared pieces (`src/components/light/*`,
`src/lib/start-quote.ts`); quote flow + `/request/[token]`; FAQ, empty legs,
legal, journal (`/blog`), routes, calculator, questions, 404; guides library
+ `/guides/[slug]` (18 short guides, `src/lib/guides-short.ts`); 9 long-form
guides + 3 pricing chapters; aircraft hub, categories, models; about,
contact, how it works, programs, safety, city pages; member account and
sign-in; admin desk; share images, icons, emails.

Design rules that hold across the branch:
- Token names kept their roles (`--ink` = page paper, `--bone` = navy text,
  `--clearance` = primary fill). `.on-navy` flips tokens inside navy bands;
  `.light-window` resets them inside windows.
- System fonts only (Times / Georgia titles, Arial UI) — no web fonts.
- Every "Request a quote" form calls `seedQuote()` and goes to
  `/quote/mission`. The prototypes' estimate modal is not used.
- URLs, metadata, JSON-LD, server actions, field names and analytics
  events are kept. Two events added: `cost_calculator_estimated`,
  `faq_feedback`.

## Verified locally
- `pnpm build`, `pnpm typecheck`, `pnpm lint` pass.
- `scripts/audit-seo-snapshot.mts` diff vs a `main` build: 0 paths lost,
  27 guide paths added, 0 title / canonical / description / robots changes,
  no JSON-LD type removed.
- All analytics events and form actions on `main` still present.

## Bug fixes on this branch that also affect production
- `NOT_SMOKE` (`src/domain/common.ts`): requests with no first name or email
  were hidden from every desk list. (Commit "Fix: desk lists hid requests…")
- Share images: WebP backgrounds never rendered in Satori and the scrim had
  zero size; category pages listed six `og:image` tags (turboprop first).
- Dev only: postgres client cached on `globalThis` (connection leak); CSP
  allows `unsafe-eval` and the local Supabase http/ws origin in development.

## Decisions waiting on the owner
1. ~~Copy removed as unverifiable~~ — **decided 2026-10-06: stays
   removed.** About's five beliefs; How it works promises ("quote in 30 min
   or it's free", $5,000 credit), its old steps ("dispatch picks up within
   five minutes", "three to five aircraft in under thirty minutes",
   "four-hour soft hold"), six old How it works FAQs. Do not restore.
2. ~~Rate mismatch~~ — **decided 2026-10-06: the rate card wins.**
   `HOURLY_USD` in `quote-pricing.ts` now reads the midpoint of each
   category's market range in `rates.ts` (light $3,400, midsize $4,400,
   super-mid $5,650, heavy $8,100, ultra $10,800/hr), so every estimate
   (quote wizard, calculator, route, city and model pages, pricing-guide
   PDF) follows the card. The card has no turboprop row: turboprop keeps
   its old share of the light rate (≈ $2,800/hr) until the owner sets one.
3. The 27 new guides' copy came from the design tool — needs a read.
   Invented slugs to confirm: cabin amenities, charter vs first class,
   charter vs fractional, corporate multi-city.
4. dispatch@jetnine.com (contact pages) vs `SITE.email` info@jetnine.com.
5. About team names that look like placeholders ("Sarah Smith", "James Lee").
6. Membership tiers still unconfirmed (from REDESIGN_PLAN).
7. `/guides` metadata still says "Pricing Guide (2026)".
8. Existing claims kept but unbacked: "within 30 minutes" quotes, "pick-up
   under twenty seconds", ARG/US / Wyvern lines.

## Known gaps
- OG headlines render in Satori's default sans (no serif font bundled).
- Migrations journal: **entries for 0043–0053 added 2026-10-06**, so
  `db:migrate` builds a fresh database end to end (checked on a scratch
  Postgres 16 with Supabase stand-ins: all 54 apply). Production is not
  changed by this: its `drizzle.__drizzle_migrations` still holds 32 rows
  ending at 0031 (checked 2026-10-06), although every migration through
  0053 is applied there (each one's objects checked the same day). **Do
  not run `db:migrate` against production** until its log is brought up to
  date: it would re-run 0032–0053 (0050 creates two policies with no
  `if not exists`; 0045 has an unguarded `create`). To bring it up to date,
  insert one row per migration 0032–0053 into `drizzle.__drizzle_migrations`
  with `hash` = sha256 of the `.sql` file and `created_at` = the journal's
  `when` (the existing rows follow exactly this rule). Needs the owner's OK:
  it is a write to the production database.
- ~~Warm tints as raw hex~~ — done 2026-10-06: `--panel` (#FBFAF7),
  `--panel-now` (#F1EADF) and `--panel-well` (#F3EDE3) in `globals.css`,
  Tailwind `bg-panel` / `bg-panel-now` / `bg-panel-well`. No visible change.
- Pages were tested against a local Supabase with seed data only; walk the
  quote flow, account and admin on a Vercel preview with real data before
  merging.

## Go-live plan (decided 2026-10-06)

- **One cutover PR**, `light-redesign` → `main`, squash-merged as soon as
  its checks are green. Rollback: Vercel Instant Rollback to the previous
  production deployment, then a revert PR if needed.
- The eight owner decisions above are **not** a gate. They land as their
  own commit when answered; until then the branch's copy stands (removed
  claims stay removed).
- Gates before the PR: the preview smoke (`smoke Preview` check, which
  submits one `[SMOKE]` quote and one `[SMOKE]` inquiry) is green on the
  branch head — **passed 2026-10-06 on 6517970** — and the signed-in walk
  below is done.
- After merge: the production deploy reaches READY, the post-deploy smoke
  passes, `/api/health` is healthy, Sentry is quiet for an hour. Then
  PostHog vs the baseline in `docs/LAUNCH_CHECKS.md` (filter
  `$host = jetnine.com`), Search Console for the 27 new guide URLs, and
  the next Semrush crawl (errors 0, warnings ≈ 118).

### Preview smoke tests follow the redesign (2026-10-06)
`tests/prod-smoke/contact-form.spec.ts` targeted the old contact page
(heading "One desk", labels "Departing" / "Arriving" / "Date or window",
"Send to dispatch", "Sent. A dispatcher will reply"), so every preview
of this branch failed the browser smoke, and production would have
failed it after the cutover. It now drives the redesigned form. The
quote-wizard test needed no change: it walks all four redesigned steps
and the request page still shows the `JN-` code.

## Signed-in walk on the preview (Claude in Chrome)

Run from a Claude session on the owner's computer, with Chrome signed in
to the preview as an owner:
https://jet-nine-website-git-light-redesign-alwayzlegits-projects.vercel.app

The preview uses the **production** database, live Stripe and real
email/SMS. **Read only:** open and look; no Approve / Reject, no status
changes, no messages, no saves, no payments. Note anything that looks
broken, unstyled, misaligned on a phone width, or shows the wrong data.

Account (`/account`): each of the seven sections; one quote → its
`/request/<token>` page; one trip; invoices; membership; preferences
(do not save).

Admin (`/admin`): Requests (each tab; open one real request: options,
holds, thread, Needs your OK and Assistant notes cards); Trips (upcoming,
past; open one trip); Clients (list; open one client: ledger, trips);
Messages (all tabs incl. Needs your OK; open one thread); Settings
(Reports, Team, Notifications, Connections, API keys, Assistant: Today /
Instructions / Memory, History, Reference data incl. one operator,
aircraft and airport page).

Compare a few against production (`jetnine.com/admin/...`) for the same
records: same counts, same rows, same numbers. Record the result here.
