# Daily Blog Task — Hand-off (Cowork, API only)

One article a day on jetnine.com/blog, written and published entirely through
the site's blog API (`BLOG_API.md`) — no MCP connectors, no repo checkout.
Topic selection comes from the post inventory and the live sitemap; the hero
comes from the site's image endpoint. Runs as a **scheduled task in Cowork** on
the owner's machine.

## State

**Live now**
- Blog system on production: index with hero thumbnails; article pages with
  hero, table of contents, FAQ block (FAQPage schema), related posts,
  BlogPosting + BreadcrumbList JSON-LD, og:image.
- Eight published articles, each with a hero and a FAQ.
- Admin API: `/api/admin/blog` (CRUD), `/api/admin/blog/image` (generate with
  `HF_TOKEN`, or ingest an https image), `/api/admin/blog/library` (seven
  cluster-keyed fallback heroes).
- The interim cloud routine has been deleted; the Cowork task is the only
  daily poster.

**Needs the owner**
- Create the scheduled task in Cowork with the prompt below (no folder —
  only HTTPS requests plus the Hugging Face connector for the hero image).
- Paste the blog API key (`BLOG_ADMIN_API_KEY` in Vercel) into the prompt.
- Enable the Hugging Face MCP connector on the task. Its Z-Image-Turbo tool
  generates the hero; the site's image endpoint then ingests it (no
  `HF_TOKEN` on Vercel needed — that variable only matters for a caller
  with no image tool of its own).
- Keep the machine awake at the run time (Cowork tasks run locally).

## Setting up the task in Cowork

1. Open Cowork in the Claude desktop app → *Scheduled tasks* (label may read
   *Schedule* or *Tasks* by version).
2. New task. Name: *Daily JetNine blog post*. Working folder: none or scratch.
3. Schedule: daily, 9:00 AM local, at an hour the machine is awake and online.
4. Instructions: the prompt below with `<<BLOG_ADMIN_API_KEY>>` replaced.
   Connectors can stay off.
5. Save; run once manually; open the reported URL; confirm article, hero and
   FAQ render.

## Prompt

```text
Write and publish today's article on the JetNine blog (https://jetnine.com/blog). Today's date is in your context — use it for seasonal angles. Everything you need is on the live site and its API plus the Hugging Face connector for the hero image; you need no local files, only the ability to make HTTPS requests (curl or an equivalent).

Credentials: the blog API key is <<BLOG_ADMIN_API_KEY>>. Send it as an "Authorization: Bearer <key>" header on every request to https://jetnine.com/api/admin/blog and its sub-paths.

1. INVENTORY. GET https://jetnine.com/api/admin/blog and list every existing title, slug and tag. Then fetch https://jetnine.com/sitemap.xml — it lists every page on the site (route pages under /routes/, city guides under /private-jet-charter/, aircraft categories and models under /aircraft/, the pricing guide under /guides/, question pages under /questions/, safety pages under /safety/). Those URLs are the only valid internal link targets. Today's post must be a genuinely new topic, not a rewrite of one that exists.

2. TOPIC. Rotate across these clusters and choose the one least recently covered by the existing posts: charter pricing and cost concepts; empty legs; one aircraft category or specific model from the sitemap; a deep dive on one route that has a landing page; one city market that has a guide; safety and operator vetting; first booking and how it works; jet cards and membership. Seasonal and event-driven angles (holiday weekends, ski season, major events on a route) are encouraged when timely. Pick ONE topic that serves real search intent and funnels readers into a specific sitemap page. Read that page first so the article agrees with it.

3. WRITE. 900–1,400 words in the JetNine desk voice: direct, concrete, first-person-plural dispatch-desk perspective, dry wit welcome, no marketing fluff. GitHub-flavored markdown with 4–6 "##" sections (the page builds a table of contents from them). Put the target phrase naturally in the title, the description and the first paragraph. Include 3–6 internal links as site-relative paths taken from the sitemap (for example /cost-calculator, /guides, /empty-legs, /routes/…, /private-jet-charter/…, /aircraft/…, /questions/…, /safety/…, /blog/…). Before posting, request every internal link target on https://jetnine.com and confirm it returns HTTP 200; fix or drop any that fail.
   Hard rules: never hand-type charter prices, hourly rates or discount percentages that can go stale — link to /cost-calculator, /guides or the relevant route or city page instead; statutory numbers (7.5% federal excise tax, FAA Part 135 / Part 295) are fine. Never invent reviews, ratings, statistics, staff names, client stories or testimonials. Leave the author field unset. title ≤ 60 characters (the site appends " · JetNine"); description ≤ 160 characters; 2–4 tags; slug lowercase-hyphenated; faq: 3–5 {q, a} pairs answering the questions a reader of this topic actually asks, each answer 1–3 sentences.

4. HERO IMAGE — every post ships with one, generated for this article. Call the Hugging Face tool gr2_z_image_turbo_generate (Z-Image-Turbo) with resolution "1536x864 ( 16:9 )", steps 8, random_seed true, and a prompt of the form: "Editorial private-aviation photograph: <the article's specific subject — aircraft type, airport, season, time of day>. Natural light, cinematic, realistic, no text, no logos, no visible faces." The tool returns an https image URL. Then POST https://jetnine.com/api/admin/blog/image with JSON {"slug": "<slug>", "sourceUrl": "<that https URL>"}. On 201 the response "url" is the durable hero URL — use it as heroImageUrl. If the tool or the ingest fails twice, fall back to GET https://jetnine.com/api/admin/blog/library and pick the entry whose clusters best match the topic (use its url and alt). Always set a specific one-sentence heroImageAlt describing what the image shows.

5. PUBLISH. POST https://jetnine.com/api/admin/blog with Content-Type application/json and a body containing title, description, slug, tags, faq, heroImageUrl, heroImageAlt, bodyMd and "status": "published". On 409 choose a different slug — never overwrite. Never PUT or DELETE any existing post in this task.

6. VERIFY. Request the URL the API returns: HTTP 200, the title present in the HTML, an <img> whose src is the hero URL, and "@type":"FAQPage" present. Confirm the hero URL itself returns 200. If anything fails, fix it with a PUT on today's slug only. If publishing fails twice, stop and report the error plainly instead of forcing it.

Finish with a three-line summary: the URL, the topic cluster chosen, and the hero source (generated or library).
```

## Environment variables (site side)

| Variable | Where | State | Purpose |
| --- | --- | --- | --- |
| `BLOG_ADMIN_API_KEY` | Vercel | set | Bearer token for every admin blog endpoint |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel | set | Image endpoint stores heroes in the public `blog` bucket |
| `HF_TOKEN` | Vercel | not needed | Only for server-side generation via `POST /api/admin/blog/image {"prompt"}` when the caller has no image tool; the Cowork task generates through the Hugging Face connector and ingests with `sourceUrl` |
| `BLOG_IMAGE_MODEL` | Vercel | optional | Override the Inference-router model for the `prompt` path (default FLUX.1-schnell) |

## Daily bar

- One new URL under /blog, HTTP 200, listed on the index with a hero thumbnail.
- A hero generated for the article (Z-Image-Turbo via the Hugging Face connector); library only as the fallback.
- Title ≤ 60 chars; title/description/opening paragraph carry the target phrase.
- 3–6 internal links, all verified 200, all taken from the live sitemap.
- FAQ of 3–5 real questions, emitted as FAQPage schema.
- No dollar figures that go stale; nothing invented.
- No existing post modified.

## Where things live

- API reference: `BLOG_API.md`
- Article rendering: `src/app/(marketing)/blog/[slug]/page.tsx`; markdown pipeline `src/lib/markdown.ts`
- Hero library: `public/images/blog/library/` + `src/lib/blog-hero-library.ts`
- Storage: Supabase bucket `blog` (public read), `heroes/<slug>-<stamp>.webp`
