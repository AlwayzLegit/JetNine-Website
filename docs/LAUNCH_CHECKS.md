# Redesign launch checks (phase 6, 2026-10-02)

What was checked before the simplification redesign was declared done,
how to re-run each check, and what is still to do after it deploys.

## 1. URLs, metadata and structured data — passed

Compared the pre-redesign build (`efaff8e`, the commit before #67) with
the phase 6 build, both on placeholder env (no database), with
`scripts/audit-seo-snapshot.mts`.

| Check | Result |
| --- | --- |
| Sitemap URLs (plus robots.txt, llms.txt) | 113 before, 113 after, none missing or added |
| Status codes | 113 × 200 before and after; no new redirects |
| `<title>` | 0 changed |
| Canonical | 0 changed |
| Meta robots | 0 changed |
| JSON-LD types per page | identical: Organization 111, WebSite 111, BreadcrumbList 95, Airport 92, FAQPage 90, Service 54, Product 15, ItemList 5, Article 5, AboutPage / Blog / LocalBusiness / HowTo 1 |
| Meta descriptions | 51 changed, wording only (dictionary: "NM" → "nm", airframe → aircraft, transcon → coast to coast, sector → leg) |
| JSON-LD text values | changed inside existing blocks only (FAQ answers, descriptions, job titles in sentence case); no field or block removed |

Not covered without a database: blog posts (`/blog/<slug>`). The sitemap
falls back to `/blog` only, identically on both builds. Their
BlogPosting / BreadcrumbList / FAQPage markup comes from code that the
redesign restyled but did not restructure; check one post on production.

Re-run:

```
pnpm audit:seo --base http://localhost:3300 --out before.json        # old build
pnpm audit:seo --base http://localhost:3300 --out after.json --include-paths before.json
pnpm audit:seo --diff before.json after.json   # exit 1 on a missing path, lost canonical or JSON-LD type
```

## 2. Phones and accessibility — passed

`scripts/audit-launch.mts` on every sitemap URL plus the quote steps,
sign-in, a request status page and the 404 (117 pages), at 390px and
1440px:

| Check | First run (main after phase 5) | Phase 6 |
| --- | --- | --- |
| Sideways scroll at 390px | 53 pages | 0 |
| Controls under 24px | footer, breadcrumbs, card links on most pages | 0 |
| axe WCAG 2.1 A/AA | scroll regions not keyboard-reachable (30 pages), one contrast failure on /faq | 0 violations |
| Load errors | 0 | 0 |

Fixes: the bleed strips use the real phone gutter (16px below 640px, not
a fixed 20px); scrolling tables are positioned so a screen-reader label
inside them cannot stretch the page; scroll regions take focus and carry
a label; text links get a 44px tap area on phones without moving the
layout (`.tap-pad`, opt-in, inline links only) or become 44px rows
(`inline-flex min-h-11 items-center`) when they stand alone; footer links
are 44px rows on phones; the FAQ topic count uses steel instead of
steel-dim.

Re-run: `pnpm audit:launch --base http://localhost:3100` (exit 1 on any
overflow, sub-24px control, serious axe finding or load error).

## 3. Traffic baseline — recorded, compare after launch

PostHog, `$host = jetnine.com`, 30 days to 2026-10-02 (mostly before the
redesign; phases 1–2 went live on 2026-10-01):

| Measure | Value |
| --- | --- |
| Visitors | 56 |
| Pageviews | 108 |
| Sessions | 63 |
| Average session | 88 s |
| Bounce rate | 82.5% |
| Sessions that viewed `/` | 13 |
| Sessions that reached `/quote/*` | 4 |
| Sessions that viewed `/contact` | 4 |
| `quote_submitted` events | 0 (the database also has no non-test quote in the window) |

The redesign's goals are home → quote entry and quote completion. With
this little traffic, compare the same queries 30 days after the last
phase deploys and read them as direction, not statistics.

## 4. After deploy

- [ ] Read the Semrush site audit for project "Jetnine". It crawls daily on its own; the 2026-10-03 16:14 UTC crawl is the first of the finished redesign. Before: 2026-09-28 — 0 errors, 120 warnings, mostly low text-to-HTML ratio; 2026-10-02 00:50 UTC (phases 1–2 live) — 153 pages, 0 errors, 119 warnings (118 low text-to-HTML ratio), 4 notices.
- [x] Open one blog post on production and check its BlogPosting JSON-LD in the page source. Done 2026-10-02 on the phase 6 deploy: `/blog/challenger-350-charter-explained` returns 200 with Organization, WebSite, BlogPosting, BreadcrumbList and FAQPage (5 questions); canonical is the jetnine.com URL.
- [x] Production smoke after the phase 6 deploy passed (GitHub "Post-deploy smoke"); its `[SMOKE]` quotes landed with a status token and a reply deadline of 30 minutes from the desk setting.
- [ ] Read the new acknowledgment email: `[SMOKE]` quotes skip email by design, so submit one real test quote with your own address and open the status link from it.
- [ ] Walk the member account and the dispatch desk signed in (they need live data, so they were not rendered locally).
- [ ] In 30 days: re-run the PostHog queries above and compare.

Known issue, not caused by the redesign: the aircraft-category social images (`/aircraft/[category]/opengraph-image`) still return a valid PNG, but the background photo is a `.webp` file that the image renderer cannot read (Vercel runtime error since June), so the card renders without the photo. Fix: give the cards JPEG or PNG copies of the six fleet photos.
