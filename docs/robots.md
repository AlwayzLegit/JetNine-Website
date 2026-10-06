# JetNine robots policy

Endpoint: https://jetnine.com/robots.txt

Production shares one policy between the wildcard and the five previously named
crawlers. Public pages, the sitemap, Next.js assets, and images remain crawlable.
Private route roots use three boundaries: `/admin$` for the bare URL, `/admin?`
for its query variants, and `/admin/` for descendants. This avoids accidentally
blocking a future public URL such as `/administrative-services`.

The sitemap declaration always uses the canonical production host. There is no
Google-unsupported `Host:` directive. Preview/development environments disallow
crawling and do not advertise a production sitemap. These exclusions are not
access controls: protected content still requires authentication, and a URL can
appear in search even when crawling is disallowed. AI crawler permissions remain
unchanged; Google-Extended does not control Google Search indexing.

## Technical acceptance checklist

Each item is worth ten points in a repository engineering review, not a Google
rating. Award points only after the corresponding checks pass; Google-side
processing and privacy enforcement are outside this score.

1. Production robots endpoint responds directly with HTTP 200.
2. Response is UTF-8 plain text below Google's 500 KiB limit.
3. Public sitemap pages are permitted by the active crawl rules.
4. Required image and Next.js rendering asset paths are permitted.
5. Private route roots and descendants are excluded.
6. Query variants of private roots are excluded.
7. Similarly named public paths are not accidentally excluded.
8. Existing named-crawler policies share one consistent rule group.
9. Canonical sitemap discovery is present, with no unsupported directives.
10. Preview/development blocking and production behavior have regression tests;
    the live monitor checks robots availability, format, size, and sitemap access.

## Checks

- `pnpm check:sitemap` covers environment selection, including preview builds
  using `NODE_ENV=production`.
- `pnpm exec playwright test tests/e2e/robots.spec.ts tests/e2e/sitemap.spec.ts`
  validates the generated HTTP response and public sitemap pages.
- `python3 scripts/test-live-sitemap.py` checks the live monitor's failure cases.
- `python3 scripts/check-live-sitemap.py` audits production read-only.

The robots test matcher deliberately supports only the literal paths and terminal
`$` used here. If wildcard rules are introduced, validate them with Google's REP
parser rather than extending assumptions silently.

## Google verification still required

Use Search Console's robots.txt report to inspect Google's fetched copy and
request a recrawl if it is outdated. The sitemap's reported "Couldn't fetch"
error is not proven resolved by a successful external request or by this change.
Inspect that error separately and confirm successful sitemap processing.
