import Image from "next/image";
import Link from "next/link";
import { SearchCard } from "@/components/home/search-card";
import { SITE } from "@/lib/constants";

/**
 * Home hero from the simplification prototype: full-bleed runway photo
 * with the left-dark / bottom-fade scrim, eyebrow, Fraunces 300 title,
 * 19px lead, primary quote button + phone button, one note line, then
 * the search card inside the same section. Fills the viewport under the
 * sticky header on desktop (720px floor, 920px ceiling); on phones it
 * is as tall as its content, with the buttons folded into the nav.
 */
export function Hero() {
  return (
    <section className="relative flex items-center overflow-hidden bg-ink md:min-h-[max(720px,min(calc(100vh-var(--header-h)),920px))]">
      {/* LCP element — preload. The shot is dark on the left where the
          headline sits, so the scrim only has to guarantee contrast. */}
      <Image
        src="/images/hero/runway-night.webp"
        alt=""
        aria-hidden
        fill
        priority
        fetchPriority="high"
        sizes="100vw"
        className="object-cover object-[60%_center]"
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(7,8,10,0.94) 0%, rgba(7,8,10,0.78) 45%, rgba(7,8,10,0.35) 100%), linear-gradient(180deg, rgba(7,8,10,0.3) 0%, rgba(7,8,10,0) 40%, rgba(7,8,10,0.95) 100%)",
        }}
      />

      <div className="container-jn relative z-10 w-full pt-[88px] pb-16 max-md:pt-10 max-md:pb-10">
        <p className="mb-5 text-[14px] font-medium text-bone-2 max-md:mb-3">
          Est. {SITE.legal.foundedYear} — Los Angeles
        </p>
        <h1 className="title-page max-w-[14ch] max-md:text-[40px]">Ready when you are.</h1>
        <p className="lead mt-6 max-w-[48ch] max-md:mt-4 max-md:text-[16px]">
          Private jet charter, anywhere, anytime — twenty thousand aircraft worldwide, one
          number to call.
        </p>

        {/* Phones: the search card's button is the primary action and the
            nav already carries dispatch, so the button row stays desktop. */}
        <div className="mt-8 flex flex-wrap items-center gap-5 max-md:hidden">
          <Link href="/quote/mission" className="btn btn-primary btn-lg">
            Request a quote <span className="arrow" aria-hidden="true">→</span>
          </Link>
          <a
            href={`tel:${SITE.dispatchPhoneE164}`}
            className="btn btn-secondary btn-lg border-[rgba(244,241,234,0.35)]"
          >
            {SITE.dispatchPhone}
          </a>
        </div>
        {/* Counter-position the industry's callback funnel: competitors'
            "instant quotes" end at an advisor phone call. Ours doesn't. */}
        <p className="mt-5 text-[15px] text-bone-2 max-md:hidden">
          Live pricing in 4 steps · rates from $2,950/hr · no callback required
        </p>

        <SearchCard />

        <p className="mt-3 text-center text-[13px] text-steel md:hidden">
          Live pricing in 4 steps · rates from $2,950/hr · no callback required
        </p>
      </div>
    </section>
  );
}
