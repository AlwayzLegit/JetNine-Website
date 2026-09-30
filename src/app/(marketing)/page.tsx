import { Hero } from "@/components/home/hero";
import { TrustBar } from "@/components/home/trust-bar";
import { Programs } from "@/components/home/programs";
import { Flow } from "@/components/home/flow";
import { WhyJetNine } from "@/components/home/why-jetnine";
import { AircraftGrid } from "@/components/home/aircraft-grid";
import { DiscretionSplit } from "@/components/home/discretion-split";
import { CtaBand } from "@/components/cta-band";
import { SITE } from "@/lib/constants";

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustBar />
      <Programs />
      <Flow />
      <WhyJetNine />
      <AircraftGrid />
      <DiscretionSplit />
      <CtaBand
        title="Ready when you are."
        body="A real human, on a real number, twenty-four hours a day. Tell us the mission — we’ll have aircraft in front of you in minutes."
        primary={{ label: "Request a quote", href: "/quote/mission" }}
        secondary={{
          label: `Call dispatch · ${SITE.dispatchPhone}`,
          href: `tel:${SITE.dispatchPhoneE164}`,
        }}
      />
    </>
  );
}
