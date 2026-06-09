import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { SITE } from "@/lib/constants";

export function Hero() {
  return (
    <header className="relative flex min-h-screen min-h-[720px] items-center overflow-hidden">
      {/* Background — gradients + scanlines + horizon glow */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 30% 50%, rgba(20,24,32,0) 0%, rgba(7,8,10,0.55) 60%, rgba(7,8,10,0.92) 100%), linear-gradient(180deg, rgba(7,8,10,0.4) 0%, rgba(7,8,10,0) 25%, rgba(7,8,10,0) 70%, rgba(7,8,10,0.85) 100%), linear-gradient(135deg, #0E1014 0%, #07080A 60%, #050608 100%)",
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
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-[18%] h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(232,226,210,0.18), transparent)",
          }}
        />
      </div>

      {/* Huge bg "9" glyph */}
      <span
        aria-hidden
        className="pointer-events-none absolute right-16 top-1/2 -translate-y-1/2 font-serif font-light leading-none text-[rgba(232,226,210,0.045)] max-md:right-[-10vw] max-md:text-[96vw] md:text-[64vw]"
        style={{ fontVariationSettings: '"opsz" 144', letterSpacing: "-0.05em" }}
      >
        9
      </span>

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
          <Link href="/quote" className="btn btn-primary btn-lg">
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
