# Blog publisher (queue branch route)

Publishes one post to jetnine.com through `/api/v1/blog/posts`, from GitHub, so no task holds the blog key.

## How a post gets published

1. Branch from **current main**: `crew/post-<YYYY-MM-DD>`. A push runs the workflow and script of the pushed branch, so an old base runs old rules.
2. Add exactly one file, `scripts/blog-publisher/queue/<slug>.json`, and push.
3. `.github/workflows/blog-publish.yml` runs `publish.mjs` with the key from the repository secret `JETNINE_BLOG_API_KEY`, then deletes the branch. Queue branches are never merged.

## Queue file fields

Same as the post fields in `BLOG_API.md`: `title` (60 max), `description` (160 max), `slug`, `bodyMd` (900 words or more, at least three `##` sections), `tags` (2 to 4), `faq` (3 to 5 `{ q, a }` pairs), `heroImageUrl` (https, or `/images/blog/library/...`), `heroImageAlt`.

Two more fields feed the quality check and are never sent to the site: `target` (the search the post answers) and `desk` (the Blog desk's verdict on six points, each `{ "pass": true, "saw": "what it saw" }`: `need`, `new`, `true`, `site_rules`, `voice`, `not_a_repeat`). A file that leaves one out is refused.

## The quality check (OPS-316)

`quality-check.mjs` runs on every queue file, in a real run and in `--dry-run`, after the cap line and before anything is sent. It prints one line per point ("pass" or "FAIL" with what it saw) and `check: N of 17 pass, sha256 ...`. Any FAIL refuses the post with the reasons; the lines print also when the cap refuses.

The six desk points are judgment, made by the Blog desk against the site's published posts; the script only refuses a missing or empty verdict. The eleven measured points: `title_meta` (title 20 to 60, description 120 to 160), `one_h1` (no `# ` line in the body), `target_in_title_and_first_100_words` (the target in the title, the description and the first 100 words), `internal_links` (3 to 6 distinct), `quote_link` (one is `/quote`), `faq` (3 to 5 complete pairs), `image_alt` (10 to 200 characters), `links_200` (every link, site or external, answers 200), `no_competitor_links` (an external link fails unless it is https to a `.gov` host; the five newest live posts link to no other site), `no_dashes`, `markdown` (no raw HTML, no skipped heading level, 900 words, three `##` sections).

## What is refused

- The cap: 3 published posts in any 7 days, counted from every source, future dates included. A constant in `publish.mjs`; no flag, env var or queue field changes it.
- `author`, `publishedAt` or a `status` other than `published` in the file.
- A slug or title already used, a slug starting with `sample-`, em or en dashes, any `$` followed by a digit, a link that does not answer 200, and any point of the quality check that fails.
- Updates and deletes: the script only creates.

## Try it

```
node --test scripts/blog-publisher/*.test.mjs
node scripts/blog-publisher/publish.mjs scripts/blog-publisher/sample-post.json --dry-run
node scripts/blog-publisher/publish.mjs scripts/blog-publisher/fixtures/failing-post.json --dry-run   # exits 1: voice, internal_links
node scripts/blog-publisher/quality-check.mjs scripts/blog-publisher/sample-post.json
node scripts/blog-publisher/publish.mjs --cap
```

Without a key the live count is read from `/blog/feed.xml` (cached up to an hour); with `JETNINE_BLOG_API_KEY` set it is read from the API.
