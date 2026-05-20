import { Hero } from "@/components/home/hero";
import { BookingWidget } from "@/components/home/booking-widget";
import { TrustBar } from "@/components/home/trust-bar";

export default function HomePage() {
  return (
    <>
      <Hero />
      <BookingWidget />
      <TrustBar />

      {/* Sections below land in wave 2: programs, how-it-works, value-props,
          fleet preview, discretion split, press + testimonials, final CTA */}
      <section className="container-jn py-32">
        <p className="caption text-bone-2">
          — Wave 1 of homepage port complete. Hero, booking widget, and trust bar are live.
        </p>
      </section>
    </>
  );
}
