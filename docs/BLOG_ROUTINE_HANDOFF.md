# Daily Blog Routine — Hand-off

One article a day on jetnine.com/blog, researched with Semrush, illustrated
with a generated hero, published through the blog API (see `BLOG_API.md`) and
verified live. This is the spec for the connector-enabled Routine created from
the claude.ai Routines UI.

## State

**Live now**
- Blog system on production: index with hero thumbnails; article pages with
  hero, table of contents, FAQ block (FAQPage schema), related posts,
  BlogPosting + BreadcrumbList JSON-LD, og:image.
- Seven published articles, each with a unique generated hero and a FAQ.
- Admin API: `/api/admin/blog` (CRUD), `/api/admin/blog/image` (generate or
  ingest a hero into Supabase storage), `/api/admin/blog/library` (seven
  cluster-keyed fallback heroes).
- Interim routine `trig_014sfnxVtExy1rp4oyn7VATu` — daily 16:00 UTC, **no
  connectors** (falls back to the library for images, no Semrush). Retire it
  once the new Routine has run cleanly.

**Needs the owner**
- Create the connector-enabled Routine from the claude.ai Routines UI. A
  Routine created from inside a session cannot carry connectors.
- Paste the blog API key (`BLOG_ADMIN_API_KEY` in Vercel) into the prompt.
- Optional: add `HF_TOKEN` to Vercel so heroes can be generated server-side
  without an attached image tool.

## Create it

1. claude.ai → Routines → New. Name: *Daily JetNine blog post*.
2. Environment: the JetNine Claude Code environment
   (`env_01BTjWVpzTPz1QYXhxUETye4`), repo `AlwayzLegit/JetNine-Website`,
   fresh session per run.
3. Schedule: daily 9:00 AM Pacific → cron `0 16 * * *` (UTC).
4. Connectors: **Semrush** (topic selection, volume/KD, competitor gaps, FAQ
   questions), **Hugging Face** (hero generation), **Supabase** (read-only
   inspection), **Vercel** (deploy state). Nothing else — the grant is
   permanent for every future run.
5. Prompt: the block below with `<<BLOG_ADMIN_API_KEY>>` replaced.
6. Run once manually; open the reported URL; confirm article, hero and FAQ
   render. Then delete the interim trigger.

## Prompt

```text
Write and publish today's article on the JetNine blog (https://jetnine.com/blog). Use the AlwayzLegit/JetNine-Website checkout for site structure (src/lib/routes.ts, cities.ts, models.ts, questions.ts) and read BLOG_API.md for the API. Today's date is in your context — use it for seasonal angles.

Credentials: the blog API key is <<BLOG_ADMIN_API_KEY>>. Send it as "Authorization: Bearer <key>" on every request to https://jetnine.com/api/admin/blog and its sub-paths.

1. INVENTORY. GET https://jetnine.com/api/admin/blog and list every existing title, slug, and tag. Today's post must be a genuinely new topic, not a rewrite of one that exists.

2. RESEARCH (Semrush). Using the Semrush tools with database "us": run keyword research around private-jet-charter themes (charter cost, empty legs, jet cards, route phrases like "private jet los angeles to new york", city phrases like "private jet charter miami", aircraft models, safety), and organic research for jetnine.com plus competitors evojets.com, jettly.com, paramountbusinessjets.com and vistajet.com. Shortlist 3–5 candidate topics with search volume and low-to-medium keyword difficulty that (a) no existing post covers and (b) map to a site page you can funnel readers into. Pick ONE. Also collect 3–5 related questions or phrases for the FAQ block. If Semrush is unavailable or returns nothing useful, fall back to rotating clusters — pricing/cost, empty legs, one aircraft category or model, one route with a landing page, one city market, safety/vetting, first booking/how it works, jet cards — choosing the cluster least recently covered.

3. WRITE. 900–1,400 words in the JetNine desk voice: direct, concrete, first-person-plural dispatch-desk perspective, dry wit welcome, no marketing fluff. GitHub-flavored markdown with 4–6 "##" sections (the page builds a table of contents from them). Put the target keyword naturally in the title, the description, and the first paragraph. Include 3–6 internal links to existing jetnine.com pages as site-relative paths (/cost-calculator, /guides, /empty-legs, /routes/…, /private-jet-charter/…, /aircraft/…, /questions/…, /safety/…, /blog/…). Before posting, curl every internal link target on https://jetnine.com and confirm HTTP 200; fix or drop any that fail.
   Hard rules: never hand-type charter prices, hourly rates, or discount percentages that can go stale — link to /cost-calculator, /guides, or the relevant route/city page instead; statutory numbers (7.5% federal excise tax, FAA Part 135 / Part 295) are fine. Never invent reviews, ratings, statistics, staff names, client stories, or testimonials. Leave the author field unset. description ≤ 160 characters; 2–4 tags; slug lowercase-hyphenated; faq: 3–5 {q, a} pairs answering the real questions from research, each answer 1–3 sentences.

4. HERO IMAGE — every post ships with one. In order of preference:
   a. Generate with a Hugging Face image tool (Z-Image-Turbo or Qwen-Image), 16:9 at about 1536×864. Prompt: an editorial private-aviation photograph specific to the article's subject, natural light, no text, no logos, no visible faces. Then make it durable: POST https://jetnine.com/api/admin/blog/image with {"slug": "<slug>", "sourceUrl": "<the https image URL the tool returned>"} and use the returned "url" as heroImageUrl.
   b. If no image tool is available, POST /api/admin/blog/image with {"slug", "prompt"} — this works when HF_TOKEN is configured on the site.
   c. If that returns 503, GET https://jetnine.com/api/admin/blog/library and pick the entry whose clusters best match the topic; use its url and alt.
   Write a specific heroImageAlt — one sentence describing the image.

5. PUBLISH. POST https://jetnine.com/api/admin/blog with Content-Type application/json and a body containing title, description, slug, tags, faq, heroImageUrl, heroImageAlt, bodyMd and "status": "published". On 409 choose a different slug — never overwrite. Never PUT or DELETE any existing post in this routine.

6. VERIFY. curl the URL the API returns: HTTP 200, the title present in the HTML, an <img> whose src is the hero URL, and "@type":"FAQPage" present. Confirm the hero URL itself returns 200. If anything fails, fix it with a PUT on today's slug only. If publishing fails twice, stop and report the error plainly instead of forcing it.

Finish with a three-line summary: the URL, the target keyword with its Semrush volume and difficulty, and the hero source (generated, ingested, or library). Do not commit or push any code.
```

## Environment variables

| Variable | Where | State | Purpose |
| --- | --- | --- | --- |
| `BLOG_ADMIN_API_KEY` | Vercel | set | Bearer token for every admin blog endpoint |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel | set | Image endpoint uploads to the public `blog` bucket |
| `HF_TOKEN` | Vercel | optional | Server-side hero generation via `POST /api/admin/blog/image {"prompt"}` |
| `BLOG_IMAGE_MODEL` | Vercel | optional | Override the Inference-router model (default FLUX.1-schnell) |

## Daily bar

- One new URL under /blog, HTTP 200, listed on the index with a hero thumbnail.
- A hero specific to the article (generated or ingested); library only occasionally.
- Title/description/opening paragraph carry the researched keyword; the run
  summary names its Semrush volume and difficulty.
- 3–6 internal links, all verified 200.
- FAQ of 3–5 real questions, emitted as FAQPage schema.
- No dollar figures that go stale; nothing invented.
- No existing post modified; no code committed.

## Where things live

- API reference: `BLOG_API.md`
- Article rendering: `src/app/(marketing)/blog/[slug]/page.tsx`; markdown pipeline `src/lib/markdown.ts`
- Hero library: `public/images/blog/library/` + `src/lib/blog-hero-library.ts`
- Storage: Supabase bucket `blog` (public read), `heroes/<slug>-<stamp>.webp`
