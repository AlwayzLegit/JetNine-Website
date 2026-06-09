# HANDOFF — JetNine Website (June 2026)

Self-contained brief for the next working session. Read this first;
LAUNCH.md / DEPLOY.md / TESTING.md cover deeper operational detail.

## Where things stand

Production: **https://jetnine.com** — Vercel project `jet-nine-website`
(team `alwayzlegits-projects`), auto-deploys from `main`.
Last major merge: PR #25 `fix(launch): replace all fabricated data`
(sha `d0fe38f`). Site is data-clean and launch-ready pending env wiring below.

### Shipped over PRs #14–#25 (one long session)

- **Imagery (60 webps):** 5 real fleet thumbnails (owner upload) + 55
  AI-generated (FLUX Krea-Dev via HuggingFace MCP): home/programs/
  discretion, 18 cabin shots, 18 sample-aircraft exteriors, dispatch room.
  Pipeline: `scripts/marketing-assets/manifest.json` + the
  `hydrate-marketing-images` GitHub Actions workflow (sandbox can't reach
  `*.hf.space`; GH runners can — append manifest entries, push, workflow
  fetches + commits binaries back). Skip-if-exists; manifest is append-only.
- **SEO:** per-page canonicals + metadata via `src/lib/page-meta.ts`;
  20+ JSON-LD blocks (Organization+WebSite w/ @id graph, FAQPage,
  BreadcrumbList+Service ×6, LocalBusiness, HowTo, ItemList/Offer,
  AboutPage+Person); sitemap image extensions; dynamic 1200×630 OG cards
  for ALL marketing pages (shared composition `src/lib/og-card.tsx`).
- **A11y/perf/misc:** skip-link, LCP priority hints, preconnect,
  theme-color, web manifest, apple-icon, security.txt, 404 noindex,
  CSP tightened (Unsplash removed).
- **Data integrity (PR #25):** all fabricated names/numbers/press/
  testimonials removed or replaced. Real values: dispatch
  **+1 (818) 900-5278**, founded **2026**, founders **Anna Agadzhanyan**
  (CEO · Dispatch) + **Arman Adamson** (COO · Operations).

## MCP status (verify at session start with whoami-style calls)

| Service  | Status | Notes |
|---|---|---|
| Supabase | ✅ | org `Jetnine` → project `JetNine Website` (`szuztxfhkudcjzhrkfld`, us-east-2) |
| Vercel   | ✅ | team `team_di6oiEhCIT17lNXsonHt3mSc` → `prj_fcimzGWfsLIjGlYvQU3kmipbactr` |
| Sentry   | ✅ account / ⚠️ no project | org `jetnine` has only unrelated projects. **Create `jetnine-website` project, get DSN, add `NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_DSN` to Vercel env.** App code already conditional on it. |
| GitHub   | ✅ | scoped to `AlwayzLegit/JetNine-Website` |
| HuggingFace | ✅ | `AlwayzLegit` — image gen via FLUX Krea-Dev |
| Stripe   | ❌ pending | Owner will connect MCP in fresh session. App-side: `/api/health` shows `stripe.configured: false`. Needs `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` in Vercel env; webhook route + money-path code already built and reviewed (PRs #11/#12). |
| PostHog  | ❌ pending | Owner will connect MCP in fresh session. Site currently has Plausible wiring (env-gated, dark). **Ask owner: PostHog replaces Plausible or runs alongside?** CSP in `next.config.ts` must add PostHog hosts either way. |

## Immediate next tasks (fresh session)

1. **Verify new MCPs** (Stripe, PostHog) are on the right accounts before touching anything.
2. **Sentry:** create `jetnine-website` project in org `jetnine` via MCP → DSN → Vercel env → redeploy → verify `/api/health` shows sentry configured.
3. **Stripe:** verify account via MCP; keys → Vercel env; configure webhook endpoint `https://jetnine.com/api/stripe/webhook`; flip through health check; run a test-mode checkout.
4. **PostHog:** decide vs Plausible; wire client lib + CSP; add env vars.
5. **Re-test:** `pnpm smoke` against prod (BASE_URL=https://jetnine.com) + the structured-data spot-checks in TESTING.md.

## Known open items (not blockers)

- **smoke Preview CI check:** was red all session. Root causes fixed in
  order: wrong URL field (PR #16), then deployment protection (owner
  disabled it), diagnostics added (PR #18 — payload dump + reachability
  probe as first workflow steps). Status unconfirmed since: check the
  next PR's smoke run; the log now says exactly what's wrong if it fails.
- **Contact-page KVNY map:** still CSS placeholder. AI maps draw the wrong
  runway layout (KVNY is parallel, models draw X). Needs Mapbox embed
  (API key) or hand-drawn SVG.
- **Founder/team headshots:** CSS initials placeholders (honest, looks
  intentional). Replace with real photos via the hydrate pipeline or a
  zip upload whenever ready. Do NOT generate AI faces for real names.
- **Contact live-status strip:** genericized with a TODO at
  `src/app/(marketing)/contact/page.tsx` (~line 142) to wire a real
  on-duty API.
- **Memberships pricing:** owner said "use these for now, we will change
  later" — flag for revisit before serious traffic.
- **Hardcoded dispatch number in lib templates:** `src/lib/email.ts` and
  `src/lib/twilio.ts` carry the number as string literals (now the real
  one). Consider importing from `src/lib/constants.ts` to keep single
  source of truth.

## Working conventions this repo expects

- Branch off `main` → PR → squash-merge. Owner has been approving
  merge-on-green pattern ("go ahead" = ship it).
- `pnpm typecheck && pnpm build` before every push; `pnpm lint` for sweeps.
- Commit messages: detailed body explaining why, no AI attribution lines
  beyond the session URL footer.
- Images: never commit raw zips (gitignored); process to webp via sharp,
  820px wide, quality ~82, then commit.
- AI imagery policy (owner-approved): OK for category-level illustration
  (cabins, aircraft types with masked tails, abstract/editorial shots).
  NOT OK for: real people's faces, factual maps, anything implying a
  specific verifiable claim.
