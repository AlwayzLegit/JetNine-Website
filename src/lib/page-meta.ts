import type { Metadata } from "next";

// Per-page metadata helper. The root layout sets a sensible default
// canonical ("/") and openGraph block, which is correct for the home
// page but propagates verbatim to every child — so without an override,
// Google sees /about, /safety, /memberships etc. all canonicaling to
// "/" and treats them as duplicates of the home page.
//
// pageMetadata() returns the override block: same title and description
// the page already had, plus a path-specific canonical and openGraph /
// twitter title + URL so social shares of /about don't say
// "JetNine — Private aviation, ready when you are" (the home tagline).
//
// The root layout's title.template (`%s · JetNine`) still applies to
// the <title> tag; we just have to spell out the resolved title for the
// openGraph + twitter blocks because Next.js doesn't apply title
// templates to those.
//
// `image` optionally overrides the default /opengraph-image route so a
// share of /aircraft/light previews with the actual Citation CJ3+
// thumbnail, /about with the dispatch room, etc. Resolution is relative
// to metadataBase (set on the root layout), so a site-relative path
// like "/images/fleet/light.webp" becomes the absolute URL Open Graph
// and Twitter card scrapers expect.
export function pageMetadata(opts: {
  /** Short title used in <title> (the template adds " · JetNine"). */
  title: string;
  /** ≤160 chars, used for meta description, og:description, twitter:description. */
  description: string;
  /** Site-relative path with leading slash (e.g. "/about"). */
  path: string;
  /** Optional site-relative image path for og:image / twitter:image. */
  image?: string;
  /** Optional alt text for the image. Defaults to the resolved page title. */
  imageAlt?: string;
}): Metadata {
  const resolvedTitle = `${opts.title} · JetNine`;
  const imageBlock = opts.image
    ? {
        images: [
          {
            url: opts.image,
            alt: opts.imageAlt ?? resolvedTitle,
          },
        ],
      }
    : {};
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: opts.path },
    openGraph: {
      title: resolvedTitle,
      description: opts.description,
      url: opts.path,
      ...imageBlock,
    },
    twitter: {
      title: resolvedTitle,
      description: opts.description,
      ...(opts.image ? { images: [opts.image] } : {}),
    },
  };
}
