import Image from "next/image";

type Props = {
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  lead?: React.ReactNode;
  /** Full-bleed photo behind the text (e.g. "/images/hero/aircraft.webp"). */
  imageSrc?: string;
  imageAlt?: string;
  /** CSS object-position, e.g. "62% center". */
  imagePosition?: string;
  /** Content rendered inside the hero, under the lead (a fact grid, a stat strip). */
  children?: React.ReactNode;
  className?: string;
  /** Extra classes for the h1 — e.g. a wider `max-w-[18ch]` for long titles. */
  titleClassName?: string;
};

/**
 * Public-page hero from the simplification handoff: bottom-aligned text
 * over a photo with the left-dark / bottom-fade scrim, or a plain ink
 * band when no photo is given. Eyebrow 14px 600 bone-2, Fraunces 300
 * title, 19px lead. Sits directly under the sticky header.
 */
export function PageHero({
  eyebrow,
  title,
  lead,
  imageSrc,
  imageAlt = "",
  imagePosition = "62% center",
  children,
  className = "",
  titleClassName = "",
}: Props) {
  return (
    <section
      className={[
        "relative flex items-end overflow-hidden bg-ink",
        imageSrc ? "min-h-[520px] max-md:min-h-[420px]" : "",
        className,
      ].join(" ")}
    >
      {imageSrc ? (
        <>
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
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgba(7,8,10,0.92) 0%, rgba(7,8,10,0.7) 45%, rgba(7,8,10,0.3) 100%), linear-gradient(180deg, rgba(7,8,10,0.4) 0%, rgba(7,8,10,0) 40%, #07080A 100%)",
            }}
          />
        </>
      ) : null}
      <div
        className={[
          "container-jn relative z-10 w-full",
          imageSrc ? "pt-[120px] pb-14 max-md:pt-16 max-md:pb-10" : "pt-[88px] pb-12 max-md:pt-12 max-md:pb-10",
        ].join(" ")}
      >
        <p className="mb-4 text-[14px] font-semibold text-bone-2">{eyebrow}</p>
        <h1 className={`title-page max-w-[14ch] !text-[clamp(44px,5.5vw,64px)] ${titleClassName}`}>{title}</h1>
        {lead ? <p className="lead mt-5 max-w-[56ch]">{lead}</p> : null}
        {children}
      </div>
    </section>
  );
}
