import Image from "next/image";
import { Reveal } from "@/components/reveal";

type Props = {
  kicker: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  /**
   * Optional full-bleed hero photo behind the header band. When omitted,
   * the header stays the original flat ink band — so utility pages
   * (/faq, /legal, /contact) are untouched and stay clean.
   */
  imageSrc?: string;
  /**
   * Alt text for the photo. Defaults to "" (decorative) since these are
   * mood/brand images, not content the reader needs described.
   */
  imageAlt?: string;
  /**
   * CSS object-position for the photo (e.g. "60% center"). Lets each page
   * frame its subject toward the right, keeping the darkened left third
   * clear under the left-aligned headline.
   */
  imagePosition?: string;
};

/**
 * Shared marketing-page header. Sits below the fixed nav and provides
 * a consistent intro band: small dash + kicker, display-xl headline,
 * optional lead paragraph. Used by /aircraft, /memberships,
 * /empty-legs, /about, etc.
 *
 * Pass `imageSrc` to turn it into a photographic hero: a full-bleed
 * next/image (fill + priority) behind the content with the homepage
 * hero's two-axis contrast scrim, so bone text stays AA-readable over
 * the photo. Mirrors src/components/home/hero.tsx.
 */
export function PageHeader({
  kicker,
  title,
  lead,
  imageSrc,
  imageAlt = "",
  imagePosition = "60% center",
}: Props) {
  return (
    <header className="relative overflow-hidden border-b border-ink-3 bg-ink pt-[200px] pb-24 max-md:pt-[140px] max-md:pb-16">
      {imageSrc ? (
        <>
          {/* Background photo — these are shot dark on the left where the
              headline sits, so the scrim guarantees contrast rather than
              rescuing it. LCP element, so it preloads (priority). */}
          <Image
            src={imageSrc}
            alt={imageAlt}
            aria-hidden={imageAlt === "" ? true : undefined}
            fill
            priority
            sizes="100vw"
            className="object-cover"
            style={{ objectPosition: imagePosition }}
          />
          {/* Two-axis contrast scrim — darker on the left (under the text)
              and along the top/bottom edges (nav legibility + section
              blend), lighter mid-right so the subject reads through. */}
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
        </>
      ) : null}

      <div className="container-jn relative z-10">
        <Reveal className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-bone-2">
          <span className="block h-px w-8 bg-clearance" />
          {kicker}
        </Reveal>
        <Reveal as="h1" stagger={1} className="display-xl max-w-[14ch]">
          {title}
        </Reveal>
        {lead ? (
          <Reveal stagger={2} as="p" className="mt-8 max-w-[56ch] text-[18px] leading-[1.55] text-bone-2">
            {lead}
          </Reveal>
        ) : null}
      </div>
    </header>
  );
}
