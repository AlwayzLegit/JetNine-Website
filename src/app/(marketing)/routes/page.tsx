import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { CtaBand } from "@/components/cta-band";
import { ROUTES } from "@/lib/routes";
import { RoutesHero } from "@/components/routes/routes-hero";
import { RoutesExplorer } from "@/components/routes/routes-explorer";
import { routeCard } from "@/components/routes/route-data";
import { AirportBand, BeforeYouRequest, RouteFaq, RouteGuideBand, RouteSources } from "@/components/routes/sections";

export const metadata: Metadata = pageMetadata({
  title: "Private Jet Charter Routes — Cost by City Pair",
  description:
    "Charter costs and flight times for the lanes we fly most — LA to Vegas, New York to Miami, coast to coast, international — priced live, whole aircraft, all-in.",
  path: "/routes",
});

const FAQ = [
  { q: "Can I request a route that is not listed?", a: "Yes. Send the city pair, dates and passenger details for a trip-specific review." },
  { q: "Will my flight be nonstop?", a: "It depends on the aircraft offered, load, winds and airports. Nonstop suitability is confirmed by the operating carrier for your itinerary." },
  { q: "Can I choose a different airport?", a: "Often, yes. Compare airport options around your final address, then confirm suitability for the aircraft and your schedule." },
  { q: "Are route prices confirmed quotes?", a: "No. Route prices are indicative planning figures. A written proposal names the aircraft, operator, total price and terms." },
];

// Light - Routes: paper photo hero, overlapping finder, the filterable
// lane grid beside the plan-your-flight aside, airport band, navy guide
// band, sources, questions and the closing band.
export default function RoutesHubPage() {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");

  const listJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "JetNine charter routes",
    itemListElement: ROUTES.map((r, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `${r.from.city} to ${r.to.city}`,
      url: `${siteUrl}/routes/${r.slug}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Build-time stringified site copy — not user-controlled.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(listJsonLd) }}
      />

      <RoutesHero
        crumbs={[{ label: "Home", href: "/" }, { label: "Routes" }]}
        title="Private Jet Charter Routes"
        subline="Your city pair. A better way to plan."
        lead={`Explore ${ROUTES.length} route guides with indicative whole-aircraft prices and flight times, compare airport options and find the right aircraft for your trip.`}
      />

      <RoutesExplorer cards={ROUTES.map(routeCard)} aside={<BeforeYouRequest />} />

      <AirportBand />
      <RouteGuideBand />
      <RouteSources />
      <RouteFaq title="Good questions before you fly." items={FAQ} />

      <CtaBand
        title="Your route is the starting point."
        body="Tell us the trip. Request a clear aircraft-specific proposal."
        primary={{ label: "Request a quote", href: "/quote/mission" }}
        secondary={null}
        imageSrc="/images/light/mountain-landscape.webp"
        imagePosition="right center"
        className="!mt-[26px]"
      />
    </>
  );
}
