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

## Owner decisions (2026-10-06)
**The Claude Design handoff is the final word on copy and everything else.**
Where a page's copy came from the design, it stays exactly as designed;
do not rewrite it for verifiability. Applied to the open items:
1. Copy removed during the port (About's five beliefs; How it works'
   "quote in 30 min or it's free" and $5,000 credit promises, its old
   steps — "dispatch picks up within five minutes", "three to five
   aircraft in under thirty minutes", "four-hour soft hold" — and six old
   FAQs) came from the old site (it is on `main` at d86a601). The design
   decides: whatever the design screens show goes on the page as
   designed; what they don't show stays out. Not re-checked against the
   design files yet (they are not in the repo).
2. Rates: the rate card wins. `HOURLY_USD` in `quote-pricing.ts` reads the
   midpoint of each category's market range in `rates.ts` (light $3,400,
   midsize $4,400, super-mid $5,650, heavy $8,100, ultra $10,800/hr) for
   every estimate. The card has no turboprop row: turboprop keeps its old
   share of the light rate (≈ $2,800/hr) until the owner sets one.
3. The 27 new guides, their slugs included, stay as designed.
4. Contact pages keep dispatch@jetnine.com as designed (`SITE.email`,
   info@, is unchanged elsewhere).
5. About team names stay as designed.
6. Membership tiers: as designed.
7. `/guides` metadata ("Pricing Guide (2026)") is not in the design; it is
   unchanged.
8. Claims the design carries ("within 30 minutes" quotes, "pick-up under
   twenty seconds", ARG/US / Wyvern lines) stay.
9. The Concierge screen (`Light - Concierge.dc.html`) is built by the owner
   on a separate branch.

## Known gaps
- OG headlines render in Satori's default sans (no serif font bundled).
- ~~Migrations journal~~ — done 2026-10-06. `_journal.json` lists all
  54 migrations, so `db:migrate` builds a fresh database end to end
  (checked on a scratch Postgres 16 with Supabase stand-ins). Production's
  `drizzle.__drizzle_migrations` was brought up to date the same day with
  the owner's OK: 22 rows for 0032–0053 (`hash` = sha256 of the `.sql`
  file, `created_at` = the journal's `when`, the rule the earlier rows
  follow), after checking each migration's objects exist there. It now
  holds 54 rows ending at 0053, so `db:migrate` against production has
  nothing to apply. New migrations: add the journal entry with the file.
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
