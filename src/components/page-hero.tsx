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
 * Public-page hero from the light handoff. With a photo: a navy band, the
 * photo under a navy left-to-right scrim, white serif title (the Home hero
 * grammar). Without one: a plain paper page intro in ink. Sits directly
 * under the sticky header.
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
  const onPhoto = Boolean(imageSrc);
  return (
    <section
      className={[
        "relative flex items-end overflow-hidden",
        onPhoto ? "on-navy min-h-[460px] bg-navy max-md:min-h-[380px]" : "bg-ink",
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
                "linear-gradient(90deg, rgba(18,35,46,0.97) 0%, rgba(18,35,46,0.9) 30%, rgba(18,35,46,0.35) 62%, rgba(18,35,46,0.08) 100%)",
            }}
          />
        </>
      ) : null}
      <div
        className={[
          "container-jn relative z-10 w-full",
          onPhoto ? "pb-14 pt-[96px] max-md:pb-10 max-md:pt-14" : "pb-10 pt-14 max-md:pb-8 max-md:pt-10",
        ].join(" ")}
      >
        <p className={`eyebrow mb-4 ${onPhoto ? "!text-navy-on-2" : ""}`}>{eyebrow}</p>
        <h1 className={`title-page max-w-[16ch] !text-[clamp(34px,7vw,64px)] ${titleClassName}`}>
          {title}
        </h1>
        {lead ? (
          <p className={`mt-5 max-w-[56ch] font-serif text-[19px] leading-[1.45] ${onPhoto ? "text-bone" : "text-steel"}`}>
            {lead}
          </p>
        ) : null}
        {children}
      </div>
    </section>
  );
}
