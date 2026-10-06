import Image from "next/image";
import { Breadcrumb, type Crumb } from "@/components/light/breadcrumb";

/**
 * Paper page intro with the photo pinned to the right edge of the
 * viewport (Light - Safety, Light - Private charter): breadcrumb, serif
 * h1, copy and actions in the left half of the 1240px container. On
 * phones the photo drops below the copy.
 */
export function EdgeHero({
  crumbs,
  title,
  subtitle,
  body,
  actions,
  imageSrc,
  imagePosition = "center",
  imageAlt = "",
  caption = "Illustrative imagery",
  children,
}: {
  crumbs: Crumb[];
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  body?: React.ReactNode;
  actions?: React.ReactNode;
  imageSrc: string;
  imagePosition?: string;
  imageAlt?: string;
  caption?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden">
      <div className="container-jn grid gap-8 pt-[18px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        <div className="pb-[26px]">
          <Breadcrumb items={crumbs} />
          <h1 className="mt-[14px] font-serif text-[clamp(34px,9vw,52px)] font-normal leading-[1.04] tracking-[-0.01em]">{title}</h1>
          {subtitle ? <p className="mt-1 font-serif text-[clamp(22px,5vw,26px)] leading-[1.2]">{subtitle}</p> : null}
          {body ? <div className="mt-3 max-w-[52ch] text-[16px] text-steel">{body}</div> : null}
          {actions ? <div className="mt-5 flex flex-wrap gap-3">{actions}</div> : null}
          {children}
        </div>
        <div className="max-md:hidden" />
      </div>
      <div className="absolute bottom-0 right-0 top-0 w-[max(36%,calc(50%-620px+1240px*.36+32px))] bg-surface-2 max-md:relative max-md:h-[240px] max-md:w-full">
        <Image src={imageSrc} alt={imageAlt} aria-hidden={imageAlt ? undefined : true} fill priority sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" style={{ objectPosition: imagePosition }} />
        {caption ? (
          <span className="absolute bottom-2 right-[14px] whitespace-nowrap text-[12px] text-white [text-shadow:0_1px_2px_rgba(0,0,0,.5)]">
            {caption}
          </span>
        ) : null}
      </div>
    </section>
  );
}

