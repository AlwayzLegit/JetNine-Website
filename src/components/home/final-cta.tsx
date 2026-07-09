import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { SITE } from "@/lib/constants";

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden py-48 sm:py-32">
      {/* Radial accent + scanlines */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(232,226,210,0.04) 0%, rgba(7,8,10,0) 60%), linear-gradient(180deg, rgba(7,8,10,1) 0%, rgba(7,8,10,0.92) 100%)",
        }}
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 18px)",
          }}
        />
      </div>

      <div className="relative z-10 container-jn text-center">
        <Reveal as="h2" className="display-l mx-auto max-w-[18ch]">
          Ready when you are.
        </Reveal>
        <Reveal stagger={1} as="p" className="mx-auto mt-8 max-w-[58ch] text-[18px] leading-[1.55] text-bone-2">
          A real human, on a real number, twenty-four hours a day. Tell us the mission — we&rsquo;ll
          have airframes in front of you in minutes.
        </Reveal>
        <Reveal stagger={2} className="mt-12 flex flex-wrap items-center justify-center gap-6">
          <Link href="/quote/mission" className="btn btn-primary btn-lg">
            Request a quote <span className="arrow">→</span>
          </Link>
          <a href={`tel:${SITE.dispatchPhoneE164}`} className="btn btn-secondary btn-lg">
            Call dispatch · {SITE.dispatchPhone}
          </a>
        </Reveal>
      </div>
    </section>
  );
}
