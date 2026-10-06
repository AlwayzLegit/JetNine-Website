import Image from "next/image";
import { SearchCard } from "./search-card";

/**
 * Home hero from Light - Home: navy band, the jet photo pinned right under
 * a navy left-to-right scrim, uppercase kicker, 78px serif title, a serif
 * lead and an underlined link down to "how it works". The search card
 * overlaps the bottom edge of the band by 78px.
 */
export function Hero() {
  return (
    <>
      <section className="on-navy relative bg-navy">
        <Image
          src="/images/light/page-01-hero.webp"
          alt=""
          aria-hidden
          fill
          priority
          sizes="100vw"
          className="object-cover"
          style={{ objectPosition: "80% center" }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(18,35,46,0.97) 0%, rgba(18,35,46,0.9) 30%, rgba(18,35,46,0.35) 58%, rgba(18,35,46,0.05) 100%)",
          }}
        />
        <div className="container-jn relative pb-[170px] pt-[84px]">
          <p className="mb-4 text-[12px] font-bold uppercase tracking-[0.18em] text-navy-on-2">
            Private jet charter, considered.
          </p>
          <h1 className="title-page !text-[clamp(34px,9vw,78px)]">
            Your journey.
            <br />
            On your terms.
          </h1>
          <p className="mt-[18px] max-w-[34ch] font-serif text-[20px] leading-[1.4]">
            The right aircraft. A clear quote.
            <br />
            A journey shaped around you.
          </p>
          <a href="#how" className="rule-link rule-link-on-navy mt-[26px] inline-flex items-center gap-2 !text-[17px]">
            Discover the JetNine approach <span className="arrow-sm !text-[13px]" aria-hidden="true">↗</span>
          </a>
        </div>
      </section>

      <div className="container-jn relative z-[2] -mt-[78px]">
        <SearchCard />
      </div>
    </>
  );
}
