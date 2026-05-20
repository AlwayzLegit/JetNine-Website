import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { SITE } from "@/lib/constants";

type Props = {
  heading: string;
  body: string;
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string };
};

/**
 * Closing-CTA band reused on most marketing pages. Defaults to "Request a
 * quote" + "Call dispatch" with the live dispatch number.
 */
export function ClosingCTA({
  heading,
  body,
  primary = { label: "Request a quote", href: "/quote" },
  secondary,
}: Props) {
  const secondaryCta = secondary ?? {
    label: `Call dispatch · ${SITE.dispatchPhone}`,
    href: `tel:${SITE.dispatchPhoneE164}`,
  };

  return (
    <section className="relative overflow-hidden border-t border-ink-3 bg-ink-2 py-48 sm:py-32">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 18px)",
        }}
      />
      <div className="relative z-10 container-jn text-center">
        <Reveal as="h2" className="display-l mx-auto max-w-[24ch]">
          {heading}
        </Reveal>
        <Reveal stagger={1} as="p" className="mx-auto mt-6 mb-12 max-w-[50ch] text-[18px] leading-[1.55] text-bone-2">
          {body}
        </Reveal>
        <Reveal stagger={2} className="flex flex-wrap items-center justify-center gap-6">
          <Link href={primary.href} className="btn btn-primary btn-lg">
            {primary.label} <span className="arrow">→</span>
          </Link>
          <a href={secondaryCta.href} className="btn btn-secondary btn-lg">
            {secondaryCta.label}
          </a>
        </Reveal>
      </div>
    </section>
  );
}
