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

### Added later: Concierge and Birthday party (branch `light-redesign-concierge`)
Two screens that arrived in a later handoff export:
- `/private-jet-concierge` (Light - Concierge) and
  `/private-jet-birthday-party` (Light - Birthday party), with
  `src/components/concierge/*` (static sections, shared planner kit, one
  client planner per page: trip drawer, review, checklist, destination and
  support windows).
- Requests send through `submitContactInquiry` as reason `quote`
  (no schema change): organizer name split into first/last, a blank date
  sent as "Flexible", every planner detail in `notes` under
  "[Concierge request]" / "[Birthday request]". They land on
  `/admin/messages`. Event: `contact_inquiry_submitted` with
  `source: "concierge" | "birthday"`.
- Linking: header nav follows the screens' nav (Concierge replaces
  Journal; Journal stays in the footer); footer gains Concierge and
  Birthday charters; both pages are in the sitemap; Birthday links back to
  Concierge and vice versa.
- Photos converted from the handoff PNGs to WebP in
  `public/images/concierge/`.

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
1. Copy removed as unverifiable — restore if these are real policies:
   About's five beliefs; How it works promises ("quote in 30 min or it's
   free", $5,000 credit), its old steps ("dispatch picks up within five
   minutes", "three to five aircraft in under thirty minutes", "four-hour
   soft hold"), six old How it works FAQs.
2. Rate mismatch (pre-existing): `HOURLY_USD` in `quote-pricing.ts`
   (light $5,500/hr) vs the published rate card in `rates.ts`
   ($3,200–3,600/hr); both show on `/cost-calculator`.
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
- Migrations 0043–0053 are not in `src/db/migrations/meta/_journal.json`,
  so `db:migrate` skips them on a fresh database (production applied them
  by hand). Local testing needed them applied manually.
- Warm tints with no token are used as raw hex in a few areas
  (`#FBFAF7`, `#F1EADF`, `#F3EDE3`…) — candidate `--panel` tokens.
- Pages were tested against a local Supabase with seed data only; walk the
  quote flow, account and admin on a Vercel preview with real data before
  merging.
