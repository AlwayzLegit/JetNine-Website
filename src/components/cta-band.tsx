import Link from "next/link";
import { SITE } from "@/lib/constants";

type Props = {
  title?: React.ReactNode;
  body?: React.ReactNode;
  /** Primary action. Defaults to calling dispatch. */
  primary?: { label: string; href: string };
  /** Secondary action. Defaults to the quote flow. */
  secondary?: { label: string; href: string };
  className?: string;
};

/**
 * Final call-to-action band shared by every public page in the
 * simplification: centred Fraunces title, one line of body, primary
 * "Call dispatch" and secondary "Request a quote". 112px above, 128px
 * below, matching the handoff's section rhythm.
 */
export function CtaBand({
  title = "Talk to a dispatcher. Same one, every flight.",
  body = "Tell us the route. We'll be in touch within thirty minutes.",
  primary = { label: "Call dispatch", href: `tel:${SITE.dispatchPhoneE164}` },
  secondary = { label: "Request a quote", href: "/quote/mission" },
  className = "",
}: Props) {
  const PrimaryTag = primary.href.startsWith("/") ? Link : "a";
  const SecondaryTag = secondary.href.startsWith("/") ? Link : "a";
  return (
    <section className={`container-jn pt-[112px] pb-[128px] text-center max-md:pt-20 max-md:pb-24 ${className}`}>
      <h2 className="title-section mx-auto max-w-[20ch] !text-[clamp(36px,4.5vw,52px)]">{title}</h2>
      {body ? <p className="mx-auto mt-5 max-w-[56ch] text-[18px] text-bone-2">{body}</p> : null}
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <PrimaryTag href={primary.href} className="btn btn-primary btn-lg">
          {primary.label}
        </PrimaryTag>
        <SecondaryTag href={secondary.href} className="btn btn-secondary btn-lg">
          {secondary.label}
        </SecondaryTag>
      </div>
    </section>
  );
}
