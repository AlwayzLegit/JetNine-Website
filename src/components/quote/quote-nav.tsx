import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { SITE } from "@/lib/constants";

export function QuoteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-ink-3 bg-[rgba(7,8,10,0.92)] backdrop-blur-[14px]">
      <div className="container-jn flex h-[72px] items-center justify-between">
        <Link
          href="/"
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-bone"
        >
          ← Save &amp; exit
        </Link>
        <BrandMark />
        <a
          href={`tel:${SITE.dispatchPhoneE164}`}
          className="hidden items-center gap-3 font-mono text-[11px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-bone md:flex"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-clearance opacity-75" />
            <span className="relative h-2 w-2 rounded-full bg-clearance" />
          </span>
          Dispatch open · {SITE.dispatchPhone}
        </a>
      </div>
    </header>
  );
}
