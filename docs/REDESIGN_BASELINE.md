# Redesign baseline (2026-09-30)

What the site is today, measured, so the redesign brief can be scoped
against it and nothing that quietly matters gets lost. Details of the new
direction are still to come from the owner; this is the "before".

## 1. What is on the site

**34 marketing route templates** under `src/app/(marketing)/`, expanding
to roughly 200 public URLs:

| Section | Template | Generated pages |
| --- | --- | --- |
| Home, About, Contact, FAQ, How it works, Legal, Memberships, Safety (+3 sub-pages), Empty legs, Cost calculator | static | 13 |
| Aircraft | `/aircraft`, `/aircraft/[category]`, `/aircraft/[category]/[model]` | 6 categories, 20 models |
| City hubs | `/private-jet-charter`, `/private-jet-charter/[city]` | 29 cities |
| Routes | `/routes`, `/routes/[slug]` | 27 routes |
| Guides | `/guides` + 5 long-form guides (gated PDF download) | 7 |
| Questions | `/questions/[slug]` | 21 |
| Blog | `/blog`, `/blog/[slug]` (+ confirm / unsubscribe) | 34 published posts, one added daily by the Cowork task |

Non-marketing surfaces that share the shell and tokens: the 4-step quote
wizard (`/quote/*`), sign-in, member account (`/account/*`), and the
dispatcher admin (`/admin/*`, 17 sections incl. `/admin/settings/ai`).

## 2. Current design system

The live site was built from the Claude Design bundle in
`_design_package/jetnine-redesign/` (May 2026): tokens in the app match
that bundle's `shared.css` byte for byte apart from `--steel`, which was
lifted for WCAG AA. Source of truth in code: `src/app/globals.css`
(330 lines) and `tailwind.config.ts`.

- **Palette:** ink `#07080A / #0E1014 / #161A20 / #1E232B`, bone
  `#F4F1EA / #C9C4B8`, steel `#7B8290`, single accent "clearance"
  `#E8E2D2` (hover `#FFFFFF`), status green/amber/red. Dark only; no
  light theme.
- **Type:** Fraunces (display serif, 300–600), Inter (UI), JetBrains Mono
  (captions, codes, kickers). Loaded via `next/font`. Scale classes
  `display-xl/l/m`, `h1–h3`, `body-l/m`, `caption`.
- **Layout:** 1280px container, `--pad-x` 64 → 48 → 24 → 16 px by
  breakpoint, 80px fixed header with scroll-padding.
- **Primitives:** `.btn` (+primary/secondary/ghost/sm/lg), `.field-jn`,
  `.caption`, `.container-jn`, article body styles for the markdown blog.
- **Shared components:** `site-nav`, `site-footer`, `page-header`,
  `closing-cta`, `proof-strip`, `reveal` (scroll reveal), `brand-mark`,
  `placeholder` (image with scanline fallback), `quote-launcher`,
  `rate-table`, `kvny-map`. Home is nine sections in
  `src/components/home/` (hero, booking widget, trust bar, value props,
  fleet preview, how it works, programs, discretion split, final CTA).
- **Imagery:** `public/images/` (3.2 MB, all WebP). Brand: logo dark/white
  PNG, wordmark bone/ink. Heroes for 6 pages, 6 fleet categories, 3
  program cards, 1 discretion image, 1 about image, 7 blog heroes plus a
  library. Everything except the logo is AI-generated placeholder art
  (see `public/images/README.md`); no real photography and no real people.

## 3. What the redesign must not break

**SEO surface (the site's main acquisition channel).**
- URLs are the asset: 29 city pages, 27 route pages, 21 question pages,
  20 model pages and 34 blog posts are indexed. Keep every path, or add a
  308 redirect in `next.config.ts` (10 convention redirects already live:
  `/about-us`, `/privacy`, `/terms`, `/login`, `/fleet`, `/pricing`, …).
- `/sitemap.xml` (`src/app/sitemap.ts`), `/robots.txt`, `/llms.txt`,
  IndexNow pings on blog publish, canonical tags and per-route metadata
  (`src/lib/page-meta.ts`) all derive from the route list.
- Structured data lives in the pages: Organization (root layout),
  BlogPosting + BreadcrumbList + FAQPage (blog), FAQPage on guides, city
  and safety pages, and the cost calculator. Any new page component must
  carry the same JSON-LD or rankings drop.
- Semrush site audit (project "Jetnine", crawled 2026-09-28): health
  score 95, 0 errors, 120 warnings across 119 of 151 pages, 4 notices.
  Warnings are dominated by one issue class (id 112, low text-to-HTML
  ratio, a symptom of the design-heavy markup). A redesign with leaner
  markup would clear most of them.

**Compliance copy that carriers and regulators audit.**
- `/legal` section 1.7: SMS disclosures (message types, frequency, rates,
  STOP/START/HELP, no-sharing clause). A2P 10DLC was approved on this
  text; keep it verbatim and reachable.
- Footer: explicit "Privacy policy" and "Terms of service" links (A2P
  vetting scans for them; rejection 30907 was cleared by adding them).
- Empty-leg watchlist form: point-of-collection SMS consent line linking
  to `/legal#sms`.
- Part 295 disclosure on `/legal` and in the footer; the "380 approved of
  ~5,000 vetted" and ARG/US / Wyvern claims are the proof points the
  copy leans on.

**Behaviour wired into the marketing surface.**
- Quote wizard is the conversion path (105 quotes to date). Zustand
  store, 4 steps, airport autocomplete over the 60-airport catalog,
  indicative pricing from `quote-pricing.ts`.
- Empty-leg watchlists (double opt-in SMS + email), blog subscribe
  (double opt-in), contact form, guide download gate: all server actions
  with rate limits and honeypots.
- PostHog events to keep firing: `quote_submitted`,
  `contact_inquiry_submitted`, `empty_leg_watchlist_created`
  (`src/lib/analytics.ts`, `track()`).
- Accessibility: WCAG AA contrast was audited (`scripts/audit-contrast.mts`,
  `scripts/audit-mobile-a11y.mts`); skip link, 44px touch targets,
  reduced-motion respected in `reveal`.

## 4. Traffic baseline (PostHog, `$host = jetnine.com`, last 30 days)

Low volume, so treat these as direction not statistics: about 40
visitors, 24 pageviews on `/`, then `/contact`, `/blog`, `/sign-in`,
`/quote/mission`, `/cost-calculator`, `/memberships`. Home bounce rate
about 45%. Most sessions are one page. The redesign's measurable goals
should be home → quote-wizard entry rate and quote completion, both
already tracked.

## 5. Database facts that shape content

`quotes` 105 · `members` 0 · `empty_legs` live 0 (board renders its
empty state) · `blog_posts` published 34 · `blog_subscribers` confirmed 0
· `voice_calls` 0. Memberships pricing tiers and founder headshots are
still open owner items (issue #30).

## 6. How I propose we run the redesign

1. **Brief in, decisions locked** (owner): scope (marketing only, or also
   quote wizard / account / admin), whether the ink-and-bone system stays
   or changes, imagery source (real photography vs generated), content
   changes vs pure visual revamp, launch style (big-bang vs page by page).
2. **Design source.** If it is another Claude Design bundle, drop it in
   `_design_package/` beside the first one; I read the chat transcript
   and the HTML and implement from the source, not screenshots.
3. **Tokens first.** New palette / type / spacing land in
   `globals.css` + `tailwind.config.ts` behind the same variable names so
   every page moves at once; then shared shell (nav, footer, buttons,
   fields); then pages in traffic order: home, quote wizard, aircraft,
   memberships, city/route templates, blog, the rest.
4. **Every PR** ships with typecheck, lint, build, the Playwright smoke,
   the contrast and mobile a11y audits, and a Vercel preview URL for
   review. URL list and JSON-LD diffed against `main` before merge.
5. **After launch:** re-run the Semrush audit, compare PostHog home →
   quote entry against the baseline above, watch Sentry for a week.

Open questions for the owner are in item 1. Everything else here is
ready.
