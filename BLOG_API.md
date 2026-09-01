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

## Post fields

| Field | Required | Notes |
| --- | --- | --- |
| `title` | yes | ≤200 chars; becomes the H1 and `<title>` |
| `description` | yes | ≤160 chars; meta description + on-page standfirst |
| `bodyMd` | yes | Full article as markdown (GFM: tables, lists, images) |
| `slug` | no | Lowercase-hyphenated; derived from `title` if omitted |
| `status` | no | `draft` (default) or `published` — drafts 404 publicly |
| `publishedAt` | no | ISO-8601; auto-set to now on first publish |
| `tags` | no | Up to 10 short strings, shown on page + JSON-LD keywords |
| `author` | no | Defaults to `JetNine dispatch desk` |
| `heroImageUrl` | no | `https://` or site-relative (`/images/...`) |
| `heroImageAlt` | no | Alt text for the hero |

Markdown is stored as source and converted server-side with sanitization —
script tags, event handlers, and non-`https` embeds are stripped. In-body
`# h1` headings are demoted to `h2` (the title owns the H1). Relative links
to site pages (`/routes/...`, `/guides/...`) are encouraged for internal
linking.

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
    "bodyMd": "Empty legs are the cheapest way onto a private jet — when the dates work.\n\n## How the pricing works\n\nOperators price repositioning flights at **40–75% off** the on-demand rate...\n\nSee the live [empty-legs board](/empty-legs) for current listings."
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
