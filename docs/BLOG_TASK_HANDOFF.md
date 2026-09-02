# Daily Blog Task — Hand-off (Cowork)

One article a day on jetnine.com/blog, researched with Semrush, illustrated
with a generated hero, published through the blog API (see `BLOG_API.md`) and
verified live. Runs as a **scheduled task in Cowork** on the owner's machine
with the app's connectors attached. Nothing depends on a repo checkout.

## State

**Live now**
- Blog system on production: index with hero thumbnails; article pages with
  hero, table of contents, FAQ block (FAQPage schema), related posts,
  BlogPosting + BreadcrumbList JSON-LD, og:image.
- Seven published articles, each with a unique generated hero and a FAQ.
- Admin API: `/api/admin/blog` (CRUD), `/api/admin/blog/image` (generate a
  hero, or ingest any https image into durable storage),
  `/api/admin/blog/library` (seven cluster-keyed fallback heroes).
- Interim cloud trigger `trig_014sfnxVtExy1rp4oyn7VATu` — daily 16:00 UTC,
  no connectors (library heroes, no Semrush). Kept only until the Cowork task
  has run once cleanly.

**Needs the owner**
- Create the scheduled task in Cowork with the prompt below.
- Paste the blog API key (`BLOG_ADMIN_API_KEY` in Vercel) into the prompt.
- Keep the machine awake at the run time (Cowork tasks run locally).
- Confirm the first clean run so the interim trigger can be deleted.

## Create it

1. Connectors first: Semrush, Hugging Face, Supabase, Vercel connected and
   enabled in Cowork — the task inherits whatever is on when it runs.
2. New scheduled task, name *Daily JetNine blog post*. No project folder needed.
3. Schedule: daily, 9:00 AM local (any hour the machine is awake works).
4. Prompt: the block below with `<<BLOG_ADMIN_API_KEY>>` replaced.
5. Run once now; open the reported URL; confirm article, hero and FAQ render.

## Prompt

```text
Write and publish today's article on the JetNine blog (https://jetnine.com/blog). Today's date is in your context — use it for seasonal angles. Everything you need is on the live site and its API; no local files are required.

Credentials: the blog API key is <<BLOG_ADMIN_API_KEY>>. Send it as an "Authorization: Bearer <key>" header on every request to https://jetnine.com/api/admin/blog and its sub-paths. Use whatever HTTP tool you have (curl or an equivalent) for these requests.

1. INVENTORY. GET https://jetnine.com/api/admin/blog and list every existing title, slug and tag. Also fetch https://jetnine.com/sitemap.xml — it lists every page on the site (routes, city guides, aircraft categories and models, guides, question pages, safety pages). Those URLs are the only valid internal link targets. Today's post must be a genuinely new topic, not a rewrite of one that exists.

2. RESEARCH (Semrush connector, database "us"). Run keyword research around private-jet-charter themes (charter cost, empty legs, jet cards, route phrases like "private jet los angeles to new york", city phrases like "private jet charter miami", aircraft models, safety), and organic research for jetnine.com plus competitors evojets.com, jettly.com, paramountbusinessjets.com and vistajet.com. Shortlist 3–5 candidate topics with search volume and low-to-medium keyword difficulty that (a) no existing post covers and (b) map to a sitemap page you can funnel readers into. Pick ONE. Also collect 3–5 related questions or phrases for the FAQ block. If Semrush is unavailable or returns nothing useful, fall back to rotating clusters — pricing/cost, empty legs, one aircraft category or model, one route with a landing page, one city market, safety/vetting, first booking/how it works, jet cards — choosing the cluster least recently covered.

3. WRITE. 900–1,400 words in the JetNine desk voice: direct, concrete, first-person-plural dispatch-desk perspective, dry wit welcome, no marketing fluff. GitHub-flavored markdown with 4–6 "##" sections (the page builds a table of contents from them). Put the target keyword naturally in the title, the description and the first paragraph. Include 3–6 internal links as site-relative paths taken from the sitemap (for example /cost-calculator, /guides, /empty-legs, /routes/…, /private-jet-charter/…, /aircraft/…, /questions/…, /safety/…, /blog/…). Before posting, request every internal link target on https://jetnine.com and confirm it returns HTTP 200; fix or drop any that fail.
   Hard rules: never hand-type charter prices, hourly rates or discount percentages that can go stale — link to /cost-calculator, /guides or the relevant route or city page instead; statutory numbers (7.5% federal excise tax, FAA Part 135 / Part 295) are fine. Never invent reviews, ratings, statistics, staff names, client stories or testimonials. Leave the author field unset. description ≤ 160 characters; 2–4 tags; slug lowercase-hyphenated; faq: 3–5 {q, a} pairs answering the real questions from research, each answer 1–3 sentences.

4. HERO IMAGE — every post ships with one. In order of preference:
   a. Generate with the Hugging Face connector's image tool (Z-Image-Turbo or Qwen-Image), 16:9 at about 1536×864. Prompt: an editorial private-aviation photograph specific to the article's subject, natural light, no text, no logos, no visible faces. Then make it durable: POST https://jetnine.com/api/admin/blog/image with JSON {"slug": "<slug>", "sourceUrl": "<the https image URL the tool returned>"} and use the returned "url" as heroImageUrl.
   b. If no image tool is available, POST /api/admin/blog/image with {"slug", "prompt"} — this works when HF_TOKEN is configured on the site.
   c. If that returns 503, GET https://jetnine.com/api/admin/blog/library and pick the entry whose clusters best match the topic; use its url and alt.
   Write a specific heroImageAlt — one sentence describing the image.

5. PUBLISH. POST https://jetnine.com/api/admin/blog with Content-Type application/json and a body containing title, description, slug, tags, faq, heroImageUrl, heroImageAlt, bodyMd and "status": "published". On 409 choose a different slug — never overwrite. Never PUT or DELETE any existing post in this task.

6. VERIFY. Request the URL the API returns: HTTP 200, the title present in the HTML, an <img> whose src is the hero URL, and "@type":"FAQPage" present. Confirm the hero URL itself returns 200. If anything fails, fix it with a PUT on today's slug only. If publishing fails twice, stop and report the error plainly instead of forcing it.

Finish with a three-line summary: the URL, the target keyword with its Semrush volume and difficulty, and the hero source (generated, ingested or library).
```

## Environment variables (site side)

| Variable | Where | State | Purpose |
| --- | --- | --- | --- |
| `BLOG_ADMIN_API_KEY` | Vercel | set | Bearer token for every admin blog endpoint |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel | set | Image endpoint stores heroes in the public `blog` bucket |
| `HF_TOKEN` | Vercel | optional | Server-side hero generation via `POST /api/admin/blog/image {"prompt"}` |
| `BLOG_IMAGE_MODEL` | Vercel | optional | Override the Inference-router model (default FLUX.1-schnell) |

## Daily bar

- One new URL under /blog, HTTP 200, listed on the index with a hero thumbnail.
- A hero specific to the article (generated or ingested); library only occasionally.
- Title/description/opening paragraph carry the researched keyword; the run
  summary names its Semrush volume and difficulty.
- 3–6 internal links, all verified 200, all taken from the live sitemap.
- FAQ of 3–5 real questions, emitted as FAQPage schema.
- No dollar figures that go stale; nothing invented.
- No existing post modified.

## Where things live

- API reference: `BLOG_API.md`
- Article rendering: `src/app/(marketing)/blog/[slug]/page.tsx`; markdown pipeline `src/lib/markdown.ts`
- Hero library: `public/images/blog/library/` + `src/lib/blog-hero-library.ts`
- Storage: Supabase bucket `blog` (public read), `heroes/<slug>-<stamp>.webp`
