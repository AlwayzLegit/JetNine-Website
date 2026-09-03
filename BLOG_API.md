# Blog Admin API

Post full articles to jetnine.com programmatically. Published posts render at
`https://jetnine.com/blog/<slug>` with the site's full SEO treatment
(canonical, meta description, `BlogPosting` + `BreadcrumbList` JSON-LD, sitemap
inclusion within the hour).

## Auth

Two ways in, either works on every endpoint:

1. **API key** — `Authorization: Bearer $BLOG_ADMIN_API_KEY`. Set
   `BLOG_ADMIN_API_KEY` in the environment (Vercel → Project → Settings →
   Environment Variables, then redeploy). Generate one with
   `openssl rand -hex 32`. If the var is unset, the bearer path is disabled.
2. **Admin session** — a signed-in browser session whose user role is
   `admin`/`superadmin` (same gate as the rest of `/admin`).

Everything under `/api/` is disallowed in robots.txt; unauthenticated calls
get a plain 401.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/admin/blog` | List all posts, drafts included |
| `POST` | `/api/admin/blog` | Create a post |
| `GET` | `/api/admin/blog/{slug}` | Fetch one post |
| `PUT` | `/api/admin/blog/{slug}` | Update (partial body OK) |
| `DELETE` | `/api/admin/blog/{slug}` | Hard delete |
| `POST` | `/api/admin/blog/image` | Generate a 16:9 hero image → public URL |
| `GET` | `/api/admin/blog/library` | Pre-generated hero images by topic cluster |

## Post fields

| Field | Required | Notes |
| --- | --- | --- |
| `title` | yes | ≤60 chars (the site appends ` · JetNine`); becomes the H1 and `<title>` |
| `description` | yes | ≤160 chars; meta description + on-page standfirst |
| `bodyMd` | yes | Full article as markdown (GFM: tables, lists, images) |
| `slug` | no | Lowercase-hyphenated; derived from `title` if omitted |
| `status` | no | `draft` (default) or `published` — drafts 404 publicly |
| `publishedAt` | no | ISO-8601; auto-set to now on first publish |
| `tags` | no | Up to 10 short strings, shown on page + JSON-LD keywords |
| `author` | no | Defaults to `JetNine dispatch desk` |
| `heroImageUrl` | no | `https://` or site-relative (`/images/...`). **Every post should have one** — see Hero images below |
| `heroImageAlt` | no | Alt text for the hero; also rendered as the caption |
| `faq` | no | Up to 12 `{ "q", "a" }` pairs — rendered as an accordion under the article and emitted as `FAQPage` JSON-LD |

Markdown is stored as source and converted server-side with sanitization —
script tags, event handlers, and non-`https` embeds are stripped. In-body
`# h1` headings are demoted to `h2` (the title owns the H1). Relative links
to site pages (`/routes/...`, `/guides/...`) are encouraged for internal
linking.

## Hero images

Every article gets a featured image; the page renders it under the header,
uses it for `og:image`, and shows it as the thumbnail on `/blog` and in
related-post cards. Two ways to get one:

**Generate** (needs `HF_TOKEN` in the environment):

```bash
curl -sS -X POST https://jetnine.com/api/admin/blog/image \
  -H "Authorization: Bearer $BLOG_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"slug": "how-empty-leg-flights-work", "prompt": "A single light private jet taxiing alone on an empty runway at dawn, mist on the grass, long shadows"}'
# → { "ok": true, "url": "https://…supabase.co/storage/v1/object/public/blog/heroes/how-empty-leg-flights-work-xxxx.webp" }
```

The endpoint appends the house style (editorial, natural light, no text/logos/faces),
converts to 1536×864 webp, and stores it in the public `blog` bucket. Pass the
returned `url` as `heroImageUrl`. Without `HF_TOKEN` it returns 503 **with the
library embedded** so a caller can fall back in one step.

**Ingest** (no token needed) — hand the endpoint any https image URL, e.g. one
produced by an image-generation tool whose hosting is temporary, and it stores
a durable 1536×864 webp copy in the bucket:

```bash
curl -sS -X POST https://jetnine.com/api/admin/blog/image \
  -H "Authorization: Bearer $BLOG_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"slug": "how-empty-leg-flights-work", "sourceUrl": "https://example.org/generated.png"}'
```

**Library** — seven pre-generated heroes keyed by topic cluster:

```bash
curl -sS https://jetnine.com/api/admin/blog/library -H "Authorization: Bearer $BLOG_ADMIN_API_KEY"
# → { "ok": true, "library": [ { "url": "/images/blog/library/turboprop-mountains.webp", "alt": "…", "clusters": ["turboprop","aspen","ski",…] }, … ] }
```

Pick the entry whose `clusters` best match the post and pass its `url` + `alt`.

## Caching

Public blog pages are ISR-cached (hourly window) so they ship font preloads
and serve from the CDN. Every `POST`, `PUT` and `DELETE` revalidates `/blog`,
`/blog/feed.xml` and the affected slug(s) — a publish or edit is visible on the
next request, no deploy or wait needed. The "from the desk" bands on route,
city, aircraft and question pages pick up new posts within an hour.

## Page anatomy

Each article renders: breadcrumb → category/read-time/date → title + standfirst
→ hero → table of contents (auto-built from `##` headings, sticky on desktop)
beside the body → FAQ accordion (if `faq` set) → three related posts (ranked by
shared tags) → quote launcher → closing CTA. Write with `##` sections — three or
more make the table of contents appear.

## Examples

Create and publish in one call:

```bash
curl -sS -X POST https://jetnine.com/api/admin/blog \
  -H "Authorization: Bearer $BLOG_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "What Empty Legs Actually Cost in September",
    "description": "Real one-way repositioning pricing from the JetNine board this month, and how to actually catch one.",
    "tags": ["empty legs", "pricing"],
    "status": "published",
    "heroImageUrl": "/images/blog/library/winter-ramp.webp",
    "heroImageAlt": "Midsize private jet on a snow-dusted ramp with a de-icing truck nearby",
    "faq": [
      { "q": "Can an empty leg be cancelled?", "a": "Yes. It exists because of someone else\u2019s trip; if that trip moves, the leg moves or disappears." }
    ],
    "bodyMd": "Empty legs are the cheapest way onto a private jet — when the dates work.\n\n## How the pricing works\n\nOperators price repositioning flights at a steep discount to the on-demand rate...\n\nSee the live [empty-legs board](/empty-legs) for current listings."
  }'
```

Draft first, publish later:

```bash
curl -sS -X POST https://jetnine.com/api/admin/blog \
  -H "Authorization: Bearer $BLOG_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "…", "description": "…", "bodyMd": "…"}'

curl -sS -X PUT https://jetnine.com/api/admin/blog/what-empty-legs-actually-cost-in-september \
  -H "Authorization: Bearer $BLOG_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status": "published"}'
```

List, fetch, delete:

```bash
curl -sS https://jetnine.com/api/admin/blog -H "Authorization: Bearer $BLOG_ADMIN_API_KEY"
curl -sS https://jetnine.com/api/admin/blog/some-slug -H "Authorization: Bearer $BLOG_ADMIN_API_KEY"
curl -sS -X DELETE https://jetnine.com/api/admin/blog/some-slug -H "Authorization: Bearer $BLOG_ADMIN_API_KEY"
```

Responses are `{ ok: true, post, url }` on success; errors are
`{ ok: false, error }` with 400/401/404/409 status.

## Editorial guardrails

Same rules as the rest of the site (`SEO_QA.md`): don't hand-type charter
prices that contradict `src/lib/rates.ts` — link to `/cost-calculator`,
`/guides`, or a route page instead of quoting numbers that will go stale;
never invent reviews, ratings, or staff names.
