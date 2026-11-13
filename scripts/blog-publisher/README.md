# Blog publisher (queue branch route)

Publishes one post to jetnine.com through `/api/v1/blog/posts`, from GitHub, so no task holds the blog key.

## How a post gets published

1. Branch from **current main**: `crew/post-<YYYY-MM-DD>`. A push runs the workflow and script of the pushed branch, so an old base runs old rules.
2. Add exactly one file, `scripts/blog-publisher/queue/<slug>.json`, and push.
3. `.github/workflows/blog-publish.yml` runs `publish.mjs` with the key from the repository secret `JETNINE_BLOG_API_KEY`, then deletes the branch. Queue branches are never merged.

## Queue file fields

Same as the post fields in `BLOG_API.md`: `title` (60 max), `description` (160 max), `slug`, `bodyMd` (900 words or more, at least three `##` sections), `tags` (2 to 4), `faq` (3 to 5 `{ q, a }` pairs), `heroImageUrl` (https, or `/images/blog/library/...`), `heroImageAlt`.

## What is refused

- The cap: 3 published posts in any 7 days, counted from every source, future dates included. A constant in `publish.mjs`; no flag, env var or queue field changes it.
- `author`, `publishedAt` or a `status` other than `published` in the file.
- A slug or title already used, a slug starting with `sample-`, em or en dashes, any `$` followed by a digit, a site link that does not answer 200.
- Updates and deletes: the script only creates.

## Try it

```
node --test scripts/blog-publisher/*.test.mjs
node scripts/blog-publisher/publish.mjs scripts/blog-publisher/sample-post.json --dry-run
node scripts/blog-publisher/publish.mjs --cap
```

Without a key the live count is read from `/blog/feed.xml` (cached up to an hour); with `JETNINE_BLOG_API_KEY` set it is read from the API.
