import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Breadcrumb } from "@/components/light/breadcrumb";

export type HeroTab = { label: string; href: string };

const crumbsFor = (crumb: string) => [
  { label: "Home", href: "/" },
  { label: "Guides", href: "/guides" },
  { label: crumb },
];

/**
 * Split hero (Broker vs operator, Charter fees, Charter cost): text on
 * paper on the left — aligned to the container edge — and a full-height
 * photo panel on the right. Stacks below ~560px.
 */
export function SplitHero({
  crumb,
  kicker,
  title,
  subtitle,
  description,
  actions,
  image,
  imagePosition = "center",
  caption = "Illustrative aviation imagery",
  titleMax = "14ch",
  subtitleSerif = true,
}: {
  crumb: string;
  kicker?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  image: string;
  imagePosition?: string;
  caption?: string;
  titleMax?: string;
  subtitleSerif?: boolean;
}) {
  return (
    <section
      className="grid border-b border-line"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))" }}
    >
      <div className="min-w-0 pb-[34px] pr-10 pt-4 max-md:pr-[var(--pad-x)]" style={{ paddingLeft: "max(var(--pad-x), calc((100vw - var(--container)) / 2 + var(--pad-x)))" }}>
        <Breadcrumb items={crumbsFor(crumb)} />
        {kicker ? <p className="mb-2 mt-[22px] text-[12px] font-bold uppercase tracking-[.18em] text-gold">{kicker}</p> : null}
        <h1
          className={`m-0 font-serif font-normal leading-[1.04] tracking-[-.01em] ${kicker ? "" : "mt-[14px]"}`}
          style={{ fontSize: "clamp(34px, 9vw, 50px)", maxWidth: titleMax }}
        >
          {title}
        </h1>
        {subtitle ? (
          <p className={`mt-3 ${subtitleSerif ? "font-serif text-[20px]" : "text-[19px]"} leading-[1.35]`}>{subtitle}</p>
        ) : null}
        {description ? <div className="mt-[6px] max-w-[50ch] text-[15px] text-bone-2">{description}</div> : null}
        {actions ? <div className="mt-5 flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
      <div className="relative min-h-[380px] bg-surface-2 max-md:min-h-[260px]">
        <Image src={image} alt="" fill priority sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" style={{ objectPosition: imagePosition }} />
        <span className="absolute bottom-[10px] right-[14px] whitespace-nowrap text-[12px] text-white [text-shadow:0_1px_2px_rgba(0,0,0,.5)]">
          {caption}
        </span>
      </div>
    </section>
  );
}

/**
 * Bleed hero (Jet sizes, Choosing a company, Compare quotes, Empty legs,
 * Safety): a photo on the right melting into paper under a left-to-right
 * scrim, the text block in the container, then a row of section tabs.
 * On phones the photo moves to a panel under the text so the copy never
 * sits on the image.
 */
export function BleedHero({
  crumb,
  title,
  subtitle,
  description,
  actions,
  tabs,
  image,
  imagePosition = "60% 50%",
  bleedWidth = "52%",
  titleMax = "16ch",
  fade = "linear-gradient(90deg,rgba(247,245,240,1) 0%,rgba(247,245,240,.97) 50%,rgba(247,245,240,.4) 64%,rgba(247,245,240,0) 80%)",
}: {
  crumb: string;
  title: ReactNode;
  subtitle?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  tabs?: HeroTab[];
  image: string;
  imagePosition?: string;
  bleedWidth?: string;
  titleMax?: string;
  fade?: string;
}) {
  return (
    <section className="relative overflow-hidden border-b border-line">
      <div className="absolute bottom-0 right-0 top-0 max-md:hidden" style={{ width: bleedWidth }}>
        <Image src={image} alt="" fill priority sizes="60vw" className="object-cover" style={{ objectPosition: imagePosition }} />
      </div>
      <div aria-hidden="true" className="absolute inset-0 max-md:hidden" style={{ background: fade }} />
      <div className="container-jn relative pt-4">
        <Breadcrumb items={crumbsFor(crumb)} />
        <h1
          className="m-0 mt-[14px] font-serif font-normal leading-[1.04] tracking-[-.01em]"
          style={{ fontSize: "clamp(34px, 9vw, 52px)", maxWidth: titleMax }}
        >
          {title}
        </h1>
        {subtitle ? <p className="mt-[10px] max-w-[52ch] text-[19px] leading-[1.35]">{subtitle}</p> : null}
        {description ? <p className="mt-1 max-w-[56ch] text-[15px] text-bone-2">{description}</p> : null}
        {actions ? <div className="mt-[18px] flex flex-wrap gap-3">{actions}</div> : null}
        <div className="relative -mx-[var(--pad-x)] mt-5 aspect-[16/9] bg-surface-2 md:hidden">
          <Image src={image} alt="" fill sizes="100vw" className="object-cover" style={{ objectPosition: imagePosition }} />
        </div>
        {tabs ? (
          <nav aria-label="Sections" className="mt-5 flex flex-wrap items-center gap-x-9 gap-y-1 max-md:mt-3">
            {tabs.map((t, i) => (
              <Link
                key={t.href}
                href={t.href}
                className={`py-[10px] text-[13px] ${i === 0 ? "font-bold text-gold shadow-[inset_0_-2px_0_var(--gold)]" : "text-bone hover:text-gold"}`}
              >
                {t.label}
              </Link>
            ))}
            <span className="ml-auto text-[12px] text-steel max-md:hidden">Illustrative image</span>
          </nav>
        ) : (
          <div className="h-[26px]" />
        )}
      </div>
    </section>
  );
}
