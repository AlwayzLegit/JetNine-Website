/**
 * Article + BreadcrumbList JSON-LD for a planning guide. Authorship is
 * the desk, matching the pricing-guide chapters (GuideShell): content is
 * written and reviewed by JetNine dispatch, not an invented person.
 */
export function GuideJsonLd({
  headline,
  description,
  path,
  crumb,
  image,
  datePublished = "2026-10-05",
  dateModified = "2026-10-05",
  isPartOf,
  extra = [],
}: {
  headline: string;
  description: string;
  /** Site-relative path, e.g. "/guides/private-jet-baggage-limits". */
  path: string;
  /** Breadcrumb label for the page itself. */
  crumb: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
  isPartOf?: Record<string, unknown>;
  /** Further schema blocks (e.g. FAQPage) to emit alongside. */
  extra?: Record<string, unknown>[];
}) {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");
  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    description,
    url: `${siteUrl}${path}`,
    mainEntityOfPage: `${siteUrl}${path}`,
    ...(image ? { image: `${siteUrl}${image}` } : {}),
    ...(isPartOf ? { isPartOf } : {}),
    author: {
      "@type": "Organization",
      name: "JetNine Dispatch Desk",
      url: `${siteUrl}/about`,
      parentOrganization: { "@id": `${siteUrl}/#organization` },
    },
    publisher: { "@id": `${siteUrl}/#organization` },
    datePublished,
    dateModified,
  };
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Guides", item: `${siteUrl}/guides` },
      { "@type": "ListItem", position: 3, name: crumb, item: `${siteUrl}${path}` },
    ],
  };
  return (
    <>
      {[article, breadcrumb, ...extra].map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          // Build-time stringified site copy — not user-controlled.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}
    </>
  );
}

export function faqJsonLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}
