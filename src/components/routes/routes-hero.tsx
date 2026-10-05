import Image from "next/image";
import { Breadcrumb, type Crumb } from "@/components/light/breadcrumb";

/**
 * Light - Routes hero: a photo under a paper left-to-right scrim (not the
 * navy PageHero), serif breadcrumb, title, serif subline and a short lead.
 * Bottom padding leaves room for the overlapping finder / facts card.
 */
export function RoutesHero({
  crumbs,
  eyebrow,
  title,
  subline,
  lead,
  imageSrc = "/images/light/page-18-hero.webp",
  imagePosition = "62% 55%",
}: {
  crumbs: Crumb[];
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subline?: React.ReactNode;
  lead?: React.ReactNode;
  imageSrc?: string;
  imagePosition?: string;
}) {
  return (
    <section className="relative overflow-hidden">
      <Image src={imageSrc} alt="" aria-hidden fill priority sizes="100vw" className="object-cover" style={{ objectPosition: imagePosition }} />
      <div
        aria-hidden
        className="absolute inset-0 max-md:!bg-[rgba(247,245,240,0.9)]"
        style={{
          background:
            "linear-gradient(90deg,rgba(247,245,240,.98) 0%,rgba(247,245,240,.94) 44%,rgba(247,245,240,.4) 66%,rgba(247,245,240,.15) 100%)",
        }}
      />
      <div className="container-jn relative pb-[70px] pt-[14px]">
        <Breadcrumb items={crumbs} className="font-serif" />
        {eyebrow ? <p className="eyebrow mb-0 mt-4">{eyebrow}</p> : null}
        <h1 className={`${eyebrow ? "mt-2" : "mt-[14px]"} max-w-[26ch] font-serif text-[clamp(34px,9vw,48px)] font-normal leading-[1.02] tracking-[-0.01em]`}>
          {title}
        </h1>
        {subline ? <p className="mt-2 font-serif text-[24px] leading-[1.2]">{subline}</p> : null}
        {lead ? <p className="mt-2 max-w-[52ch] text-[14px] leading-[1.55]">{lead}</p> : null}
        <p className="mt-[10px] text-right text-[12px] text-steel">Illustrative imagery</p>
      </div>
    </section>
  );
}
