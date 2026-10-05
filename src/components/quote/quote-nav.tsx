import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { SITE } from "@/lib/constants";

// Quote-flow header: sticky 72px bar (64px on phones), translucent ink
// with a 14px blur, grid `1fr auto 1fr` so the wordmark sits dead centre.
// Left "← Save & exit" (the draft persists in sessionStorage, so leaving
// really is saving), right the dispatch line with a success dot. On
// phones the phone number collapses to a 44px round ☏ button, same as
// the site header, so dispatch stays one tap away.
export function QuoteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white">
      <div className="container-jn grid h-header grid-cols-[1fr_auto_1fr] items-center gap-4">
        <Link
          href="/"
          className="inline-flex h-11 w-fit items-center text-[15px] text-bone-2 transition-colors hover:text-bone"
        >
          ← Save &amp; exit
        </Link>

        <BrandMark size="sm" className="md:hidden" />
        <BrandMark className="max-md:hidden" />

        <div className="flex justify-end">
          <a
            href={`tel:${SITE.dispatchPhoneE164}`}
            className="hidden items-center gap-2.5 whitespace-nowrap text-[15px] text-bone-2 transition-colors hover:text-bone md:inline-flex"
          >
            <span className="dot dot-success" aria-hidden="true" />
            Dispatch open · {SITE.dispatchPhone}
          </a>
          <a
            href={`tel:${SITE.dispatchPhoneE164}`}
            aria-label={`Call dispatch, ${SITE.dispatchPhone}`}
            className="flex h-11 w-11 items-center justify-center rounded-pill border border-line-2 text-bone transition-colors hover:border-steel md:hidden"
          >
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
}
