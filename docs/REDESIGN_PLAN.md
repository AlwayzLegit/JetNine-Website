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

Phase 1 is done on the branch (see "Phase 1 status" below). Phases 2–4
have no open questions and follow in that order. Phase 5 waits on the
decisions below.

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

1. **Operators, aircraft, airports, ops, empty-leg admin.** The handoff
   removes them from the desk. Options: (a) delete the pages and leave the
   tables in place, (b) keep them reachable under Settings › Connections as
   "reference data" for the empty-leg board and quote conversion, which
   still read those tables. I recommend (b) until Avinode replaces them.
2. **"Your request" status page for guests.** Quotes can be submitted
   without an account. A guest needs a tokenised link in the
   acknowledgment email to see status; members see it under Account ›
   Quotes. Confirm the tokenised guest link is wanted.
3. **Settings › Team / Notifications / Connections.** These are new
   features (role management, notification toggles, connection status
   cards), not restyles. Build in phase 5, or defer?
4. **Rollout.** Page-by-page PRs to `main` (the site stays live, fonts and
   chrome change first so old and new pages never mix styles), or one long
   branch with a single cutover? I recommend page by page.
