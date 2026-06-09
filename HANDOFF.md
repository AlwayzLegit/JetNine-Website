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

## MCP status (verified 2026-06-09 with whoami-style calls)

| Service  | Status | Notes |
|---|---|---|
| Supabase | ✅ | org `Jetnine` → project `JetNine Website` (`szuztxfhkudcjzhrkfld`, us-east-2, ACTIVE_HEALTHY) |
| Vercel   | ✅ | team `team_di6oiEhCIT17lNXsonHt3mSc` → `prj_fcimzGWfsLIjGlYvQU3kmipbactr`. **MCP has no env-var tools** — all env values go in via the dashboard. |
| Sentry   | ✅ account / ❌ blocked | Authenticated as anna@jetnine.com (member-level in org `jetnine`). `create_project` via MCP returns 403 "organization has disabled this feature for members". Owner must enable members-create-projects (Settings → General) or create `jetnine-website` in the UI; then DSN → Vercel env. |
| GitHub   | ✅ | scoped to `AlwayzLegit/JetNine-Website` |
| HuggingFace | ✅ | `AlwayzLegit` — image gen via FLUX Krea-Dev |
| Stripe   | ✅ **LIVE mode** | Account `acct_1TdCAEKCpHyfNVWt` "JetNine". MCP exposes neither secret keys nor webhook-endpoint management — both must come from the Dashboard. |
| PostHog  | ✅ account / ⚠️ no project | Authenticated as anna@jetnine.com, org "alwayzlegit's projects" — zero projects, and the MCP has no project-create tool. Owner creates one at us.posthog.com. Decision made: **PostHog replaces Plausible**; client lib + CSP + health check wired this session (ships dark until `NEXT_PUBLIC_POSTHOG_KEY`). |

## Owner checklist (everything below is dashboard work; agent retries once unblocked)

1. **Sentry:** flip "Let Members Create Projects" at jetnine.sentry.io → Settings →
   General (or create project `jetnine-website`, platform javascript-nextjs, yourself).
   Then: DSN → Vercel env `NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_DSN` → redeploy.
2. **Stripe (live):** Dashboard → API keys → `STRIPE_SECRET_KEY` into Vercel env.
   Dashboard → Webhooks → add `https://jetnine.com/api/stripe/webhook` with events
   `checkout.session.completed`, `payment_intent.payment_failed`, `charge.refunded`
   → signing secret into Vercel env `STRIPE_WEBHOOK_SECRET`. For a test-mode dry
   run first, use `sk_test_…` + a test-mode webhook instead.
3. **PostHog:** create project at us.posthog.com → Project API key into Vercel env
   `NEXT_PUBLIC_POSTHOG_KEY` (`phc_…`). `NEXT_PUBLIC_POSTHOG_HOST` only if not US cloud.
4. **Redeploy + verify:** `/api/health` should flip `sentry`/`stripe`/`posthog` to
   configured; `/admin/health` shows per-row status with fix hints.

## Known open items (not blockers)

- ~~smoke Preview CI check~~ — **GREEN as of 2026-06-09** (first green
  run ever). Three stacked root causes fixed in order: `tsx` missing
  from devDependencies (`tsx: not found` on every run), then two stale
  e2e assertions — the mission heading is "Where, when, how many." not
  "Where to", and quote codes are `JN-YYYY-NNNNN` not `QT-…` (the
  success matcher could never pass). The e2e now submits real [SMOKE]
  quotes end-to-end; rows land at status='cancelled' as designed.
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
- ~~Hardcoded dispatch number in lib templates~~ — done 2026-06-09;
  `email.ts` / `twilio.ts` now interpolate `SITE.dispatchPhone` from
  `src/lib/constants.ts`.

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
