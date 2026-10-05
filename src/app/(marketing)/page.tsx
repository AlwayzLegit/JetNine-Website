import { Hero } from "@/components/home/hero";
import { AircraftGrid } from "@/components/home/aircraft-grid";
import { Flow } from "@/components/home/flow";
import { QuoteExplainer } from "@/components/home/quote-explainer";
import { GuidesPreview } from "@/components/home/guides-preview";
import { CtaBand } from "@/components/cta-band";

// Light - Home: hero + trip bar, aircraft categories, how it works,
// the quote explainer, guides, and the closing band.
export default function HomePage() {
  return (
    <>
      <Hero />
      <AircraftGrid />
      <Flow />
      <QuoteExplainer />
      <GuidesPreview />
      <CtaBand
        title="Where will you go next?"
        body="Start with a conversation about your next journey."
        primary={{ label: "Request a quote", href: "/quote/mission" }}
        secondary={null}
        imageSrc="/images/light/mountain-landscape.webp"
      />
    </>
  );
}
