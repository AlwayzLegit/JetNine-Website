# SEO QA checklist

Execution hygiene is a ranking edge for this site: every audited competitor at
scale (Jettly 14,600 URLs, Paramount ~2,400, evoJets ~1,385) ships visible
template rot — lorem ipsum in production, scraped competitor copy, prices that
contradict each other across pages, malformed or missing schema, zero
canonicals. At our page count we can be flawless, and stay flawless as
programmatic pages (routes, cities, aircraft models) ship.

## Every page, before it merges

- [ ] **Canonical**: self-referencing canonical via `pageMetadata({ path })`
      (or an explicit `alternates.canonical`). Never inherit the root `/`.
- [ ] **Title**: query-first, unique, ≤60 chars with the ` · JetNine` template
      applied. No bare brand-first titles ("Light · JetNine").
- [ ] **Meta description**: unique, ≤160 chars, cut at a word boundary, carries
      a trust or price hook where natural. Never `slice(0, 160)`.
- [ ] **One H1**, carrying the page's query. Explicit `{" "}` before any
      `<br />` between text (JSX collapses the newline — extracted headings
      otherwise concatenate: "Ready whenyou are.").
- [ ] **Prices come from one source**: hourly rates from `src/lib/rates.ts`
      (stamped with `RATES_UPDATED`), trip estimates from
      `src/lib/quote-pricing.ts`. Never hand-type a dollar figure that exists
      in either module — two pages disagreeing on a price is the failure mode
      we're exploiting in competitors.
- [ ] **JSON-LD**: validate in Google's Rich Results Test. Offer/AggregateOffer
      prices must be numeric (`price: 2950`), never display strings
      ("FROM $2,950/HR" fails validation — Jettly's exact bug).
- [ ] **Server-rendered content**: anything a crawler should read (rate
      tables, FAQ answers, board listings, form shells) must be in the SSR
      HTML — check the built `.next/server/app/*.html`, not the browser.
      Client-gated content renders as a "Loading…" shell to crawlers
      (evoJets' #1-ranking calculator page has this bug; we must not).
- [ ] **Answer-shaped copy**: question as heading, one-line answer with the
      number first, detail after. This is what featured snippets and AI
      answers lift — and robots.txt explicitly allows GPTBot / ClaudeBot /
      PerplexityBot / Google-Extended for exactly that reason.
- [ ] **Internal links**: at least one crawlable link from an existing page
      (footer, hub, or cross-link module) — sitemap presence alone is weak.
- [ ] **Sitemap**: page added to `src/app/sitemap.ts` with sane priority.
- [ ] **Rendering mode**: public pages are static or ISR (`export const
      revalidate = N`), never `force-dynamic`. Next skips `next/font` preloads
      on force-dynamic pages (visible font swap, worse LCP) and the CDN
      cannot cache them. A dynamic segment also needs `generateStaticParams`
      (an empty list is fine) or it renders on demand on every request and the
      revalidate window never applies — check the Vercel build table: public
      routes should show ○ or ●, not ƒ. DB-backed pages revalidate on write
      (`revalidateBlog` in `src/lib/blog.ts` is the pattern).

## Programmatic templates (routes, cities, aircraft models), additionally

- [ ] No placeholder text of any kind reaches production (lorem ipsum,
      "TBD", empty sections). If a data field is missing, the section is
      omitted, not rendered blank.
- [ ] No unreviewed AI-generated or scraped copy. Every template's prose is
      reviewed by a human once per template, and per-page variable content
      is data (airports, prices, times), not free text.
- [ ] Slug is the query ("/aircraft/light/citation-cj3", "/routes/vny-to-ase"),
      unique, lowercase, hyphenated.
- [ ] Prices and flight times computed from the live engine at render time —
      never baked into content that can go stale.
- [ ] Related-links module sanity-checked (no self-links, no 404s).
- [ ] Ship in small batches (20–50 pages), verify indexation in Search
      Console before scaling — competitors' data shows long-tail template
      pages beyond the deep top ~30 earn nothing.
- [ ] When the first programmatic batch ships: split `sitemap.ts` into typed
      child sitemaps (routes / cities / aircraft / marketing) so indexation
      is monitorable per template in Search Console.

## Quarterly

- [ ] Rate review: confirm `src/lib/rates.ts` figures, bump `RATES_UPDATED`.
- [ ] Re-crawl with the Semrush site audit; keep health ≥96 and zero errors.
- [ ] Rich Results Test spot-check on one page per template.
