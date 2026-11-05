import type { Metadata } from "next";
import { SEO_COPY } from "./seo-copy";

// Per-page metadata helper. The root layout sets a sensible default
// canonical ("/") and openGraph block, which is correct for the home
// page but propagates verbatim to every child — so without an override,
// Google sees /about, /safety, /memberships etc. all canonicaling to
// "/" and treats them as duplicates of the home page.
//
// pageMetadata() uses reviewed SEO_COPY where present, otherwise the route
// or CMS title and description, plus a path-specific canonical and openGraph /
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
const DEFAULT_OG_IMAGE = "/opengraph-image";
const DEFAULT_OG_ALT = "JetNine — Private jet charter. Your journey, on your terms.";

export function pageMetadata(opts: {
  /** Short title used in <title> (the template adds " · JetNine"). */
  title: string;
  /** Concise page summary for search and social cards; Google has no fixed character limit. */
  description: string;
  /** Site-relative path with leading slash (e.g. "/about"). */
  path: string;
  /** Optional site-relative image path for og:image / twitter:image. */
  image?: string;
  /** Optional alt text for the image. Defaults to the resolved page title. */
  imageAlt?: string;
  /**
   * Set when the route's own directory holds an opengraph-image file.
   * No image is emitted here, so that file supplies og:image.
   */
  segmentCard?: boolean;
}): Metadata {
  // Apply reviewed copy consistently to search, Open Graph and Twitter.
  opts = { ...opts, ...SEO_COPY[opts.path] };
  const resolvedTitle = `${opts.title} · JetNine`;
  // A page's openGraph / twitter objects replace the root layout's whole,
  // including the image Next resolved from app/opengraph-image.tsx and the
  // card type. Without a fallback here, a page with no image of its own
  // (home, /blog, the city and question pages) ships no og:image and a
  // small "summary" card.
  //
  // An image set here beats an opengraph-image file in the same segment,
  // so a route that has such a file passes `segmentCard` and gets none.
  const image = opts.segmentCard ? null : (opts.image ?? DEFAULT_OG_IMAGE);
  const imageAlt = opts.imageAlt ?? (opts.image ? resolvedTitle : DEFAULT_OG_ALT);
  const images = image ? { images: [{ url: image, alt: imageAlt }] } : {};
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: opts.path },
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: "JetNine",
      title: resolvedTitle,
      description: opts.description,
      url: opts.path,
      ...images,
    },
    twitter: {
      card: "summary_large_image",
      title: resolvedTitle,
      description: opts.description,
      ...images,
    },
  };
}
