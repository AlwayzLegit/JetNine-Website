import { Hero } from "@/components/home/hero";
import { BookingWidget } from "@/components/home/booking-widget";
import { TrustBar } from "@/components/home/trust-bar";
import { Programs } from "@/components/home/programs";
import { HowItWorks } from "@/components/home/how-it-works";
import { ValueProps } from "@/components/home/value-props";
import { FleetPreview } from "@/components/home/fleet-preview";
import { DiscretionSplit } from "@/components/home/discretion-split";
import { FinalCTA } from "@/components/home/final-cta";

export default function HomePage() {
  return (
    <>
      <Hero />
      <BookingWidget />
      <TrustBar />
      <Programs />
      <HowItWorks />
      <ValueProps />
      <FleetPreview />
      <DiscretionSplit />
      <FinalCTA />
    </>
  );
}
