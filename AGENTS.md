# AGENTS.md: JetNine

Short orientation for any run that works in this repo (the Crew's Planner and Builder, or a person). It holds nothing new: every line below is already in `TESTING.md`, `DEPLOY.md`, the workflows or the Crew's project sheet. When this file and one of those disagree, the source wins, and this file is wrong and gets fixed.

## What this is

Private jet charter brokerage site, https://jetnine.com. Next.js 15, React 19, Tailwind 3, pnpm. OpenNext on Cloudflare Workers: the app Worker `jetnine-web` (staging `jetnine-web-staging`), and a small edge cache Worker `jetnine-edge` in `edge/` that owns the hostnames. Supabase Postgres with Drizzle. Stripe.

## Checks to run before a pull request

Local: `pnpm lint`, `pnpm typecheck`, `pnpm check:api`, `pnpm cf:build`, `pnpm e2e` (needs `pnpm e2e:install` once).

CI runs these on every pull request to main (`.github/workflows/ci.yml`): lint, typecheck, `check:api`, the sitemap invariants, the Cloudflare build, a wrangler dry run of the app Worker and of the edge Worker, and the Playwright smoke suite. The scripts have their own tests, run with `node --test <file>` (for example `scripts/blog-publisher/publish.test.mjs`, `scripts/speed-check/check.test.mjs`, `scripts/search-report/report.test.mjs`).

## What a push to main does

The workflow "Deploy (Cloudflare)" (`deploy-cloudflare.yml`) builds and deploys production: the app Worker, then the edge Worker with the released commit. After it, a smoke test and the production sitemap audit run. So a merge is a production deploy, with real payments, quotes and lead forms behind it.

Changes only to `voice/`, `docs/` or `*.md` files do not deploy.

Staging: run "Deploy (Cloudflare)" by hand with target staging (https://staging.jetnine.com). Proof of a deploy is the workflow run for that commit finished green, then a read of the live page.

## Risk HIGH

Anything touching payments, quotes, lead forms, auth, database migrations or the edge cache Worker. HIGH rows go to staging first, then merge alone, on the owner's yes.

## Where things live

- Health: `/api/health` (`src/app/api/health/route.ts`, `src/lib/health.ts`). The workflow `health-monitor.yml` probes it every 15 minutes. Pages the Crew's Monitor loads, each must answer 200 with its text: `/` "JetNine", `/contact` "Contact 24/7", `/cost-calculator` "Private Jet Cost Calculator", `/blog` "Private Jet Charter Blog", `/sitemap.xml` "urlset". `/contact` and `/cost-calculator` are money pages.
- Blog publishing: `blog-publish.yml` and `scripts/blog-publisher/` (fields and refusals in its `README.md`). Branch from current main as `crew/post-[YYYY-MM-DD]`, add exactly one file `scripts/blog-publisher/queue/[slug].json`, push. The workflow enforces the cap of 3 posts in 7 days. The old admin API at `/api/admin/blog` is deprecated; do not call it.
- Database target (D1 move): `src/db/target.mjs`, `src/db/d1.ts`, `DB_TARGET` per environment in `wrangler.jsonc`; see `DEPLOY.md` 8i. Production stays on Postgres until the cutover row.
- Speed check: `speed-check.yml` and `scripts/speed-check/` (weekly Lighthouse, three hard alarms). See `TESTING.md`.
- Search results report: `search-report.yml`, `scripts/search-report/` and `docs/search-report.md`.
- Sitemap: `sitemap-monitor.yml`, `pnpm check:sitemap`.
- Deploy and secrets: `DEPLOY.md`. A secret is never written to a file, a log or a pull request.

## Blog rules (site rules)

Never hand-type charter prices, hourly rates or discounts: link to `/cost-calculator`, `/guides` or a route or city page. Never invent reviews, stats, staff names or testimonials. Never modify existing posts. No em or en dashes. The `author` field stays unset.
