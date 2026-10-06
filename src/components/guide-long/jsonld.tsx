/**
 * Article + BreadcrumbList JSON-LD for a guide page, in the same shape
 * the pricing-guide chapters have always shipped (authorship is the
 * dispatch desk, not an invented person). `series` keeps the pricing
 * chapters' CreativeWorkSeries link and "Pricing guide" crumb unchanged.
 */
export function GuideJsonLd({
  title,
  description,
  path,
  crumb,
  datePublished,
  dateModified = datePublished,
  series,
}: {
  title: string;
  description: string;
  path: string;
  crumb: string;
  datePublished: string;
  dateModified?: string;
  series?: { name: string; crumb: string };
}) {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");
  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    url: `${siteUrl}${path}`,
    ...(series ? { isPartOf: { "@type": "CreativeWorkSeries", name: series.name, url: `${siteUrl}/guides` } } : {}),
    author: {
      "@type": "Organization",
      name: "JetNine Dispatch Desk",
      url: `${siteUrl}/about`,
      parentOrganization: { "@id": `${siteUrl}/#organization` },
    },
    publisher: { "@id": `${siteUrl}/#organization` },
    dateModified,
    datePublished,
  };
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: series?.crumb ?? "Guides", item: `${siteUrl}/guides` },
      { "@type": "ListItem", position: 3, name: crumb, item: `${siteUrl}${path}` },
    ],
  };
  return (
    <>
      <script
        type="application/ld+json"
        // Build-time stringified site copy — not user-controlled.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(article) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
    </>
  );
}
