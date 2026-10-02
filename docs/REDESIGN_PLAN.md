# Simplification redesign — plan (2026-09-30)

Source: `_design_package/jetnine-simplification/HANDOFF.md` (Claude Design
handoff, 21 hi-fi desktop screens, 6 mobile screens). Baseline:
`docs/REDESIGN_BASELINE.md`.

## What the handoff asks for, in one paragraph

Keep the brand (ink, bone, Fraunces, wordmark) and remove density: bigger
sentence-case type, Instrument Sans instead of Inter, JetBrains Mono dropped,
12px cards, one primary button per screen, a plain-words dictionary
everywhere. Public pages keep the live IA and copy. The quote flow keeps its
4 steps with optional groups collapsed. The account keeps its 7 sections
as a left rail. The admin collapses 15 sections to 5 (Requests, Trips,
Clients, Messages, Settings) because Avinode is now the sourcing tool and
operators, aircraft, airports and live ops are no longer managed here.

## Phases (each one a PR, each shippable on its own)

| # | Scope | Depends on |
|---|---|---|
| 1 | Tokens, Instrument Sans, shared header + footer | nothing |
| 2 | Public pages: 11 designed screens + restyle of the ~130 template pages (city, route, question, aircraft, guide, blog post) with the new tokens | 1 |
| 3 | Quote flow (4 steps) + "Your request" status page | 1 |
| 4 | Member account, 7 sections, left rail, mobile tab bar | 1 |
| 5 | Admin: five-section desk | 1, owner decisions below |
| 6 | Dictionary in emails/SMS, mobile pass, launch checks (a11y audits, URL + JSON-LD diff, Semrush re-run, PostHog comparison) | 2–5 |

All six phases are done (1–2 merged in #67, 3 in #68, 4 in #69, 5 in
#70, 6 on the branch; see the status notes below). Launch-check results
and the after-deploy list are in `docs/LAUNCH_CHECKS.md`.

### Phase 6 status

Shipped: the plain-words dictionary in everything the site sends —
client and desk emails, SMS (STOP / HELP handling and the A2P wording
kept), cron and webhook alerts — and in the source data behind the
public pages (`fleet`, `models`, `rates`, `cities`, `routes`,
`questions`, `faq`), page descriptions and JSON-LD text. Email subjects
keep their bracketed references for reply threading. The client-facing
reply time follows the desk's reply promise (Settings › Notifications)
on the quote flow, the request page, the account and the acknowledgment
emails; static marketing copy keeps the advertised 30 minutes.

Retired: JetBrains Mono, the old type classes (`display-*`, `h1–h3`,
`body-*`, `caption`, `btn-ghost`), the transition colour aliases
(`ink-3`, `ink-4`, `warn`, `error`) and four unused components. Sign-in,
error pages and social images moved to the new grammar.

Checks: URL / metadata / JSON-LD diff against the pre-redesign build
(no URL, title, canonical or structured-data type lost), a phone and
accessibility audit of every page (no sideways scroll, no control under
24px, no axe violations after the fixes), and a PostHog traffic
baseline. Scripts: `pnpm audit:seo`, `pnpm audit:launch`.

### Phase 5 status

Shipped: the dispatch desk collapsed from fifteen sections to five —
Requests, Trips, Clients, Messages, Settings — behind a 220px sidebar with
counts (gold pill for requests that need a reply, outlined pill for unread
messages), "Open Avinode ↗" and the signed-in user, and a five-tab bar on
phones. Statuses are sentences from `src/lib/desk-status.ts` ("Needs a
reply", "Working on it", "Options sent", "Booked"); the enums stay in the
database. Pages compose the primitives in
`src/components/admin/desk-ui.tsx`.

- **Requests** (`/admin/requests`): tabs by stage with counts, grouped
  rows (name · passengers, trip sentence, note; "Received 12 min ago" and
  the due line in gold / danger; Open / Continue / Nudge / View trip), search
  by name or city, phone layout with the due line first. One request
  (`/admin/requests/<id>`): client · route title, status pill, Call / Text /
  Email, four-stage strip, three columns (The trip + client, Options to send
  with "Search in Avinode ↗" / "Paste Avinode quote" and "Send options"
  enabled at two or more, Conversation). Every control of the old workbench
  is still there (status, dispatcher, link to client, holds, confirm
  booking) under "Desk tools" / "Our fleet matches and holds".
- **Trips** (`/admin/trips`): Upcoming / Flown tabs, "Flying today"
  featured card, grouped rows with the state sentence and a to-do line;
  the trip sheet keeps the invoice and status controls.
- **Clients** (`/admin/clients`): counts in the lead, All / Flew recently /
  Card members / New tabs, Name · Flights · Total spent · Membership table
  with a sticky preview drawer, "+ Invite a client"; the client page keeps
  preferences, companions, lanes, ledger, invoices.
- **Messages** (`/admin/messages`): one thread per client (quote, trip or
  member), Unread / Call notes (voice desk) / Website form (contact
  inquiries) / Problems (failed deliveries with retry) tabs, bubbles with
  channel chips, quick replies and internal notes.
- **Settings**: Reports (period segmented, three numbers, "Where requests
  ended up", Money), Team (Owner / Team roles, invite, change, remove),
  Notifications (four toggles per staff user + the reply-time promise),
  Connections (Avinode, Resend, Twilio, phone answering, Stripe, database,
  monitoring with live status and "Send a test"), History (audit log as
  sentences), Reference data (operators, aircraft, airports, live ops,
  empty legs, AI providers — kept, restyled, decision 1b).

Schema: migration `0050_desk_settings.sql` (see DEPLOY.md §8c). Old URLs
redirect from `next.config.ts`. Not in this phase: the public "within 30
minutes" copy (emails, contact page, quote review) still hard-codes 30 and
does not yet read the desk's reply promise — Phase 6 dictionary pass; the
desk pages were not rendered locally (they need a signed-in staff user and
live data), so walk them after deploy; staff notifications are email only
(no SMS to staff); the client-facing `inapp` channel is labelled "Account
note" because the member portal shows it, so a true team-only note channel
is still to come. Decisions 1 and 3 below were taken on
2026-10-02: keep the reference-data pages under Settings; build Team,
Notifications and Connections now.

### Phase 4 status

Shipped: the member account rebuilt from `Account.dc.html` — 200px sticky
left rail (seven sections with descriptions, primary "Request a quote",
sign out), a pinned four-tab bar on phones (Overview · Trips · Quote ·
More), and all seven sections on the card grammar: Overview (next trip as
a sentence, in-progress quotes linking to their status pages, past trips,
membership, invoices and dispatcher cards), Quotes (rows link to
`/request/<token>`), Trips and trip detail, Invoices, Membership, Buy /
top up, Preferences. Every query, ownership check, Stripe flow and server
action is unchanged; statuses read as sentences, no ids or enum words.

Not in the data, so not shown: membership hours (the schema holds reserve
dollars — the card shows dollars left of the deposit), terminal addresses
(the departure airport name plus "dispatch sends the exact address"), a
live dispatcher-availability signal, add-to-calendar.

### Phase 3 status

Shipped: the four-step quote flow rebuilt from `Quote.dc.html` (sticky
quote header, 4-column step bar, "Your trip so far" sidebar, compact
fields, segmented trip type, leg blocks, category cards with plain-words
fit reasons, collapsed optional sections, contact tiles and agreements,
review with Edit links and the Send-to-dispatch card) and the "Your
request" page at `/request/<token>` with the received, options, chosen,
booked and closed stages. Choosing an option marks it accepted, moves the
quote to `accepted` and alerts the desk. The acknowledgment and options
emails carry the link; the admin workbench shows it.

Schema: migration `0048_quote_status_token.sql` must be applied before
this phase deploys (see DEPLOY.md §8b). Not in scope: SMS copies of the
link (the handoff's "we texted you a copy" line reads "we emailed you a
copy" until SMS consent is collected per quote), Add-to-calendar on the
booked stage (a mailto to dispatch for now), and the member Account ›
Quotes list, which Phase 4 rebuilds to link each row to its status page.

### Phase 2 status

Shipped: the eleven designed pages (Home, Aircraft, Memberships, How it
works, Contact, About, FAQ, Empty legs, Safety, Blog & guides, Legal) rebuilt
from their prototypes, plus the restyle of every template page (city,
route, question, guide, aircraft category and model, blog post, cost
calculator, the token confirm / unsubscribe pages, the 404). Shared page
grammar lives in `globals.css` (`.eyebrow`, `.title-*`, `.card`, `.chip`,
`.segmented`, `.accordion-*`, `.stepper`, `.range-jn`, `.switch`, `.dl-jn`,
`.table-jn`, `.pill`) with `PageHero` and `CtaBand` as the shared hero and
closing band. `PageHeader` and `ClosingCTA` are thin wrappers over those.

Kept as promised: every URL, `metadata`, JSON-LD, revalidate export, the
analytics events, the legal text verbatim (including §1.7 SMS disclosures),
the watchlist SMS consent line, the Part 295 line, the contact and
watchlist server actions and their field names. The Van Nuys runway map on
/contact was dropped for the prototype's dispatch-room photo.

Still to do in later phases: the jargon inside `rates.ts`, `fleet.ts`,
`questions.ts` and the page `metadata` descriptions ("airframe", "NM",
"pax") is de-jargoned at render time on the rebuilt pages; the source data
and the JSON-LD text still carry it (Phase 6 dictionary pass). Founder
photos are placeholders until portraits are supplied. The quote-launcher
card on the template pages still fires `quote_launcher_submitted`; the
designed pages link straight to `/quote/mission` instead.

### Phase 1 status

Shipped: the token set from the handoff (`surface`, `surface-2`, `line`,
`line-2`, `line-faint`, `steel` at `#8A9099`, `steel-dim`, `gold`,
`success`, `danger`, ink-2 `#0A0C10`), Instrument Sans 400/500/600 as the
Tailwind `sans` family, the 1200px / 40px container, 12 / 8 / 999 radii,
buttons at 44 / 52 / 56px with an 8px radius, block-label inputs on
surface-2, the sticky 72px header (64px on phones, 44px round call and menu
buttons, pinned "Request a quote" in the open panel), the four-column
footer, and the nav order Aircraft · Programs · How it works · About ·
Blog · Contact.

Transition aliases kept until the pages are rebuilt: `ink-3` → line-faint,
`ink-4` → line, `warn` → gold, `error` → danger. JetBrains Mono stays
loaded while `.caption` / `font-mono` still appear on the template pages;
both go in Phase 2. Because the header is now in flow rather than fixed,
every page header lost 72px of top padding (200 → 112, 140 → 64 on phones)
so nothing moved on screen.

## Guardrails that the handoff does not mention and I will keep

- Every indexed URL stays (city, route, question, aircraft, guide, blog).
  Blog and Guides remain separate URLs; the designed tab UI links between
  them rather than merging them.
- JSON-LD, sitemap, IndexNow, canonical and per-route metadata stay as is.
- `/legal` §1.7 SMS disclosures, the footer "Privacy policy" / "Terms of
  service" links, the watchlist consent line and the Part 295 line are
  carried over verbatim (A2P 10DLC was approved on them).
- PostHog events `quote_submitted`, `contact_inquiry_submitted`,
  `empty_leg_watchlist_created` keep firing.
- SMS bodies get the dictionary but keep the STOP/START/HELP mechanics.

## Decisions needed from the owner

1. **Operators, aircraft, airports, ops, empty-leg admin.** Decided
   2026-10-02: (b) — kept under Settings › Reference data, restyled, until
   Avinode replaces them. The empty-leg board and quote matching still read
   those tables.
2. **"Your request" status page for guests.** Decided 2026-10-01: the
   tokenised guest link. Every quote gets a `status_token` (migration
   0048); the acknowledgment and options emails link to
   `/request/<token>`, the wizard lands there after submit, and the
   client picks an option from that page. The admin workbench shows the
   link so dispatch can paste it into a thread.
3. **Settings › Team / Notifications / Connections.** Decided 2026-10-02:
   built in phase 5. Team maps the database roles to two words (Owner =
   admin / superadmin, Team = dispatcher); Notifications stores per-user
   toggles and the desk-wide reply promise (migration 0050); Connections
   reads the health probes and the AI provider tables.
4. **Rollout.** Page-by-page PRs to `main` (the site stays live, fonts and
   chrome change first so old and new pages never mix styles), or one long
   branch with a single cutover? I recommend page by page.
