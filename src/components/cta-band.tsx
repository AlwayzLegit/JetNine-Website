import Image from "next/image";
import Link from "next/link";
import { SITE } from "@/lib/constants";

type Props = {
  title?: React.ReactNode;
  body?: React.ReactNode;
  /** Primary action. Defaults to calling dispatch. */
  primary?: { label: string; href: string };
  /** Secondary action. Defaults to the quote flow; `null` hides it. */
  secondary?: { label: string; href: string } | null;
  /** Optional photo behind the band, under a navy scrim. */
  imageSrc?: string;
  imagePosition?: string;
  className?: string;
};

/**
 * Closing band shared by every public page in the light handoff: a
 * full-width navy band (optionally over a photo), serif title and one
 * line of body on the left, a white primary and an outlined secondary
 * action on the right. Wraps to a stack on phones.
 */
export function CtaBand({
  title = "Talk to a dispatcher. Same one, every flight.",
  body = "Tell us the route. We'll be in touch within thirty minutes.",
  primary = { label: "Call dispatch", href: `tel:${SITE.dispatchPhoneE164}` },
  secondary = { label: "Request a quote", href: "/quote/mission" },
  imageSrc,
  imagePosition = "center 40%",
  className = "",
}: Props) {
  const PrimaryTag = primary.href.startsWith("/") ? Link : "a";
  const SecondaryTag = secondary?.href.startsWith("/") ? Link : "a";
  return (
    <section className={`on-navy relative mt-14 overflow-hidden bg-navy ${className}`}>
      {imageSrc ? (
        <>
          <Image
            src={imageSrc}
            alt=""
            aria-hidden
            fill
            sizes="100vw"
            className="object-cover opacity-80"
            style={{ objectPosition: imagePosition }}
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgba(18,35,46,0.97) 0%, rgba(18,35,46,0.9) 42%, rgba(18,35,46,0.35) 100%)",
            }}
          />
        </>
      ) : null}
      <div className="container-jn relative flex flex-wrap items-center justify-between gap-8 py-14">
        <div className="max-w-[680px]">
          <h2 className="title-section !text-[clamp(32px,7vw,50px)]">{title}</h2>
          {body ? <p className="mt-3 font-serif text-[18px]">{body}</p> : null}
        </div>
        <div className="flex flex-wrap gap-3">
          <PrimaryTag href={primary.href} className="btn btn-on-navy h-[46px] px-[22px]">
            {primary.label} <span aria-hidden="true">↗</span>
          </PrimaryTag>
          {secondary ? (
            <SecondaryTag
              href={secondary.href}
              className="btn h-[46px] border-[rgba(255,255,255,0.6)] bg-transparent px-[22px] text-white hover:border-white hover:bg-[rgba(255,255,255,0.08)]"
            >
              {secondary.label}
            </SecondaryTag>
          ) : null}
        </div>
      </div>
    </section>
  );
}
