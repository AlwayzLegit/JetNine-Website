# JetNine sitemap

Public endpoint: https://jetnine.com/sitemap.xml

The sitemap includes public catalog pages and every published blog article. Static
pages omit `lastmod` until trustworthy content dates exist; blog dates use the
stored update timestamp. Admin writes invalidate the sitemap. Runtime refreshes
run hourly and preserve the last successful ISR result when the database fails.
Production builds fail on a blog-query error, preventing a new deployment from
replacing a complete sitemap with a catalog-only fallback. Offline CI builds can
still run without production credentials.

## Verification

- `pnpm check:sitemap`: catalog coverage, exclusions, dates, image files, XML
  escaping, outage policy, and preview robots behavior.
- `python3 scripts/test-live-sitemap.py`: fault injection for the live auditor.
- `python3 scripts/check-live-sitemap.py`: read-only checks against production;
  writes `sitemap-audit.json`, exits nonzero on failure.
- `pnpm exec playwright test tests/e2e/sitemap.spec.ts`: browser XML parsing and
  page/canonical/indexability checks against the local production build.

The **Production sitemap audit** GitHub Action runs daily, manually, and after
successful production deployments. It stores its JSON evidence for 30 days.
Failures should be investigated before changing or removing affected URLs. A
redirected page must use its final canonical URL; a temporarily failing page
needs its underlying service repaired. New catalog entries come from the shared
catalog data; new standalone marketing pages must also enter `LANDINGS`.

## Ten acceptance areas

1. Valid UTF-8 XML, namespace, and XML-escaped URLs.
2. Fewer than 50,000 unique URLs and 50 MB uncompressed.
3. Complete public catalog and published blog coverage.
4. Canonical HTTPS URLs without query strings or fragments.
5. Listed pages return HTTP 200 without redirects.
6. HTML canonicals agree with the listed URLs.
7. No robots-blocked, noindex, private, or token pages.
8. Real modification dates; no generated or future dates.
9. Accessible image URLs returning image content.
10. Robots discovery, publish invalidation, outage safeguards, and automated
    production monitoring.

These are engineering acceptance criteria, not a Google score or a guarantee of
indexing. Search Console submission and Google-selected canonicals require the
verified JetNine property. Submit `https://jetnine.com/sitemap.xml` in its Sitemaps
report, check successful processing, and inspect important landing pages in URL
Inspection. This repository cannot confirm those account-side results.
