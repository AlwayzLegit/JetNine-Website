# HANDOFF — JetNine Website (updated 2026-06-15)

Self-contained brief for the next working session. Read this first.
Deeper detail: `MANUAL.md` (how the system works end-to-end), `RBAC.md`,
`DEPLOY.md`, `TESTING.md`, `LAUNCH.md`. Full history is in `git log`.

---

## 0. TL;DR — what to do next

1. **Marketing hero images** (the active task — §3). Homepage hero shipped
   (PR #36). Five more pages need one each: `/aircraft`, `/memberships`,
   `/about`, `/how-it-works`, `/safety`. **Blocked** on the Hugging Face
   image MCP tool being permission-gated in the prior session — get it
   allowed first (§2), then run the generate → manifest → hydrate pipeline (§3).
2. **Owner-only items still open:** Phase F email audit (§4.1), and the SMOKE
   test-data purge awaiting the owner's "purge" go-ahead (§4.2).
3. **Backlog issues:** #34 (admin invoice finalize + Pay-resume), #30 F/G
   (headshots, membership pricing), domain switchover (§4).

---

## 1. Production, deploy, IDs

- **App:** Next.js (App Router) + Postgres via Supabase, hosted on Vercel.
- **Live URL:** `https://jet-nine-website.vercel.app` — auto-deploys from
  `main`. Custom domain **`jetnine.com`** is the canonical/SEO target baked
  into the app (canonicals, OG, robots); the final DNS switchover to point
  it at this Vercel project was the last launch step under discussion —
  **confirm current DNS state before assuming it is already live.**
- **Branch convention:** develop on `claude/exciting-euler-hptuen`; it is
  **reset to `origin/main`** at the start of each task, so a force-push
  (`--force-with-lease`) right after the reset is expected and safe (its
  prior commits are already squash-merged into main). PRs squash-merge to
  `main`; the owner's "go ahead / merge and deploy" = ship it.
- **Commit/PR footer:** end commit messages and PR bodies with the
  `https://claude.ai/code/session_…` line. Detailed "why" in the body; no AI
  attribution beyond that footer.

**Service IDs:**
| Service | ID / slug |
|---|---|
| Vercel team | `team_di6oiEhCIT17lNXsonHt3mSc` (slug `alwayzlegits-projects`) |
| Vercel project | `prj_fcimzGWfsLIjGlYvQU3kmipbactr` (`jet-nine-website`) |
| Supabase project | `szuztxfhkudcjzhrkfld` (us-east-2) |
| Sentry | org `jetnine`, project `jetnine-website` |
| PostHog | **shared** "Default project" id `392626` in org `jetnine` — also serves mattressstoreslosangeles.com + thelookhairsalonla.com. **Always filter `$host = jetnine.com`.** |
| Stripe | account `acct_1TdCAEKCpHyfNVWt` — **LIVE mode**, webhook wired |
| GitHub | `alwayzlegit/jetnine-website` (only repo in MCP scope) |

---

## 2. Access / MCP state — READ BEFORE STARTING

In the prior session these worked: **GitHub, Vercel, PostHog, git/Bash.**

These were **gated behind the client's "MCP tool call requires approval"**
wall — connected, but every call rejected until allowed: **Supabase,
Stripe, Sentry, Hugging Face.** This is a client-side permission gate; it
cannot be cleared by instruction — only by the user in their client
(`/permissions` → set the server to always-allow, or approve the dialog).
**The hero-image task is blocked precisely on the Hugging Face gate.**
First action: confirm these are allowed, or ask the user to allow them.

Gotcha: `mcp__Vercel__web_fetch_vercel_url` on a full HTML page exceeds the
token limit and is saved to a temp file — slice it with Bash
(`grep -o … "$f"`) instead of reading it whole.

Note: the Vercel MCP has **no env-var tools** and Stripe/PostHog MCP expose
no key management — all env/key values are entered via the dashboards.

---

## 3. ACTIVE TASK — marketing hero images

**Goal:** give five marketing pages an individual, on-brand hero photo,
mirroring the homepage hero shipped in **PR #36** (`cf564d7`).

### 3a. The homepage pattern to mirror (`src/components/home/hero.tsx`)
Full-bleed `next/image` (`fill` + `priority`, `sizes="100vw"`,
`object-cover`) behind the content, with a **two-axis scrim** (darker on the
left third under the left-aligned headline, and along top/bottom edges) so
bone text stays AA-readable. Image at `public/images/hero/runway-night.webp`.

### 3b. The five pages + confirmed concepts
All five use the shared `PageHeader` (`src/components/page-header.tsx`),
which is currently **text-only** — so step one is adding an **opt-in image
slot** to it (render photo + scrim layers only when an `imageSrc` prop is
passed; utility pages `/faq`, `/legal`, `/contact` pass nothing, stay clean).

| Page | Headline | Concept |
|---|---|---|
| `/aircraft` | "Choose your aircraft." | Blue-hour ramp **lineup**, 3 jets staggered (fleet/breadth) |
| `/memberships` | "Three ways to fly." | Single jet, **airstair down, warm cabin glow** on wet night tarmac |
| `/about` | "Built on one phone number." | **Night dispatch/ops room**, glowing monitors, ramp through window, **no faces** |
| `/how-it-works` | "A senior dispatcher, not a chatbot." | Tight **dispatcher workstation**, flight-tracking screens, headset |
| `/safety` | "The floor is high." | Jet under **pre-flight inspection on a lit hangar floor** |

Brand rules in every prompt: ink-black base, cool blue + clearance-blue
accent, **dark/low-detail left third**, 16:9 landscape, photoreal, **no AI
faces presented as real staff** (issue #30 headshot policy — that's why
/about and /how-it-works use rooms/screens, not portraits).

### 3c. The exact prompts (FLUX.1 Krea-Dev, ~60–70 words each)

**/aircraft:** Blue hour at a private jet ramp, three business jets parked
in a staggered receding row, cool teal-blue twilight sky, wet reflective
tarmac mirroring soft cyan light, dark cinematic aviation photography,
subtle blue rim-light along polished fuselages, wide empty dark asphalt
across the left third, distant runway edge lights, shot on Sony A7R IV 35mm
f/2.8, ultra-sharp, high dynamic range, deep shadows, no people

**/memberships:** Private jet at night on a wet ramp, airstair door open
with warm golden cabin light spilling onto glistening tarmac, dark teal-blue
sky behind, polished dark fuselage with cool blue rim light, cinematic moody
aviation photography, empty dark asphalt across the left third, distant
apron lights as soft bokeh, shot on Sony A7R IV 35mm f/2, ultra-sharp, high
dynamic range, no people

**/about:** Private aviation dispatch operations room at night, several
glowing monitors showing flight-tracking maps casting cool blue light, an
empty operator chair and headset at the desk, a large window revealing a
dark ramp with a parked jet, moody cinematic interior photography, dark
negative space across the left third, shot on Sony A7R IV 24mm f/2.8,
ultra-sharp, deep shadows, no people, no faces

**/how-it-works:** Close-up of a private jet dispatcher's workstation in a
dark room, a curved monitor displaying a glowing cyan flight-tracking map
and route lines, a headset resting beside a keyboard, warm desk-lamp glow
against cool blue screen light, shallow depth of field, cinematic detail
photography, dark empty space across the left third, shot on Sony A7R IV
50mm f/1.8, ultra-sharp, no people, no faces

**/safety:** A business jet inside a dark hangar at night undergoing
pre-flight inspection, a bright clinical pool of light on the polished
fuselage and landing gear, glossy reflective hangar floor, cool blue ambient
shadows, precise rigorous mood, cinematic industrial aviation photography,
wide dark empty floor across the left third, shot on Sony A7R IV 35mm f/4,
ultra-sharp, high dynamic range, no people

Homepage generation params: `guidance_scale 4.5`, `num_inference_steps 28`,
`width 1344`, `height 768`. Push width higher if the tool allows (1344px
softens on 4K).

### 3d. The image pipeline (how a generated image reaches the repo)
The sandbox **cannot reach `*.hf.space`** to download a generated image, so
there is a GitHub Actions bridge (this is the established flow — it produced
55 marketing webps in an earlier session):

1. Call `mcp__Hugging_Face__gr1_flux_1_krea_dev_infer` → returns an
   **ephemeral HF-space file URL** (expires within hours).
2. Append to `scripts/marketing-assets/manifest.json` (a flat array,
   append-only, skip-if-dest-exists):
   `{ "dest": "public/images/hero/<name>.webp", "source": "FLUX.1-Krea-dev",
   "note": "<page>", "url": "<hf url>" }`
3. Push the manifest change → the **`.github/workflows/hydrate-marketing-images.yml`**
   workflow downloads each URL on a GH runner, commits the binary to `dest`,
   and pushes back. **Do this promptly — URLs expire within hours.**
4. Add `imageSrc` (+ `object-position`/scrim tuning) per page via the new
   `PageHeader` slot, then open one PR with a Vercel preview link.

> The ONLY thing blocking this end-to-end now is step 1's permission gate (§2).
> If it cannot be opened, the proven fallback is the owner supplying the five
> files (drop in `public/images/hero/`, any format — sharp-convert to webp).

---

## 4. Other open threads

- **4.1 Phase F — email content audit (owner-only).** The system sent
  magic-link, quote-ack, dispatch-alert, priced-option, and member-invite
  emails (from `JetNine <dispatch@jetnine.com>` via Resend). Owner eyeballs
  them in the inbox for sender/branding/links/typos. Delivery was verified
  server-side (Resend message IDs in the audit log); only visual render is
  unverified.
- **4.2 SMOKE test-data purge — awaiting owner "purge" go-ahead.** Do NOT
  delete until the owner confirms. Re-query Supabase to confirm the live set
  first. Known artifacts: quotes `JN-2026-00021..00023` and `00026..00032`;
  trip `JN-2026-0001` + legs; invoice `INV-2026-0001` (staged to `due`,
  carries a live `cs_live_…` session); member `M-2026-0001` (+ its `users`
  row); ~17 SMOKE `contact_inquiries`; the `empty_leg_watchlists` row for
  `alwayzlegit+smoke1@gmail.com`; empty leg `EL-2026-0007` (already
  `expired`); catalog rows aircraft `N0SMOKE`, airport `ZZSM`, operator
  `SMOKE-OP-0610`. Audit-log history stays (immutable).
- **Issue #34 — C.3:** no admin UI to finalize a `draft` invoice (line-items
  / `draft→due`); plus a Pay-resume UX fix so a second Pay click
  resumes/re-mints instead of erroring `PAYMENT_IN_PROGRESS`. Last unbuilt
  segment of the money path — member Pay → Stripe checkout itself works
  (verified live, session `cs_live_a1GJ…`).
- **Issue #30 F/G:** founder/team headshots (real photos only — no AI faces);
  confirm/revise the three `/memberships` pricing tiers.
- **Domain switchover:** attach `jetnine.com` + `www` in Vercel → point DNS.
  The app already assumes jetnine.com everywhere.

---

## 5. Shipped recently (2026-06-10 → 06-15)

- **PR #31:** revived the silently-dead production rate limiter.
- **PR #32:** mobile navigation menu (`SiteNav` hamburger).
- **PR #33:** member↔quote linkage (auto-link signed-in members + dispatcher
  attach control), empty-leg status control, past-date validation.
- **PR #35:** `MANUAL.md` operator's guide (a PDF edition was generated for
  the owner; the throwaway render scripts are in `/tmp`, not committed).
- **PR #36:** photographic homepage hero — the pattern to mirror for §3.
- Deep-test campaigns verified the whole quote→trip→invoice→Stripe chain in
  production; defects fixed in #33; remaining gap is #34. Issue #30 launch
  wiring A–E done (Stripe live, PostHog, Sentry, redeploy, leaked-pw
  decision); F/G open.

---

## 6. Conventions & gotchas

- **Branch reset + force-push** is the normal flow (§1).
- **HF image URLs expire in hours** — generate and hydrate in the same pass.
- **PostHog:** shared project → always filter `$host = jetnine.com`.
- **`[SMOKE]` first-name prefix** marks automated quote submissions
  (pre-cancelled, no emails) — safe for testing.
- **Large `web_fetch_vercel_url` output** is saved to a temp file; slice with
  Bash rather than reading whole.
- **Transient "Something went sideways" / Connection-closed on writes:** a
  stream-level drop; the write commits — reload to confirm. Not a logic bug.
- **AI imagery policy (owner-approved):** OK for aircraft/cabin/abstract/
  editorial and the marketing heroes above. NOT OK for real people's faces,
  factual maps, or anything implying a specific verifiable claim.
- **Image processing:** convert to webp via `sharp`; never commit raw zips
  (gitignored).
