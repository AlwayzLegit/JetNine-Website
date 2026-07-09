import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { SITE } from "@/lib/constants";

export function Hero() {
  return (
    <header className="relative flex min-h-screen min-h-[720px] items-center overflow-hidden bg-ink">
      {/* Background photo — full-bleed, LCP element so it preloads (priority).
          The shot is dark on the left where the headline sits, so the scrim
          below only needs to guarantee contrast, not rescue it. */}
      <Image
        src="/images/hero/runway-night.webp"
        alt=""
        aria-hidden
        fill
        priority
        sizes="100vw"
        className="object-cover object-[60%_center]"
      />

      {/* Contrast scrim — darker on the left (under the text) and along the
          top/bottom edges (nav legibility + section blend), lighter mid-right
          so the aircraft reads through. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(7,8,10,0.92) 0%, rgba(7,8,10,0.62) 34%, rgba(7,8,10,0.12) 64%, rgba(7,8,10,0.42) 100%), linear-gradient(180deg, rgba(7,8,10,0.72) 0%, rgba(7,8,10,0) 24%, rgba(7,8,10,0) 62%, rgba(7,8,10,0.9) 100%)",
        }}
      >
        {/* Faint scanline texture, carried over for brand consistency */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 18px)",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-container px-[var(--pad-x)]">
        <Reveal stagger={1} className="mb-8 inline-flex items-center gap-3.5 font-mono text-[11px] uppercase tracking-[0.16em] text-bone-2">
          <span className="block h-px w-8 bg-clearance" />
          EST. 2026 — LOS ANGELES
        </Reveal>
        <Reveal stagger={2} as="h1" className="display-xl max-w-[16ch] text-bone">
          Ready when
          <br />
          you are.
        </Reveal>
        <Reveal stagger={3} as="p" className="mt-8 max-w-[480px] text-[18px] leading-[1.55] text-bone-2">
          Private jet charter, anywhere, anytime — twenty thousand aircraft worldwide, one
          number to call.
        </Reveal>
        <Reveal stagger={3} className="mt-12 flex flex-wrap items-center gap-6">
          <Link href="/quote/mission" className="btn btn-primary btn-lg">
            Request a quote <span className="arrow">→</span>
          </Link>
          <a
            href={`tel:${SITE.dispatchPhoneE164}`}
            className="btn btn-ghost"
          >
            {SITE.dispatchPhone}
          </a>
        </Reveal>
      </div>

      {/* Scroll cue */}
      <div className="pointer-events-none absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-3">
        <span className="block h-12 w-px origin-top bg-gradient-to-b from-transparent to-clearance animate-[scrollPulse_2.4s_cubic-bezier(0.16,1,0.3,1)_infinite]" />
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-2">Scroll</span>
      </div>
    </header>
  );
}
