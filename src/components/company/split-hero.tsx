import Image from "next/image";
import { Breadcrumb, type Crumb } from "@/components/light/breadcrumb";

type Props = {
  crumbs: Crumb[];
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  /** Serif line under the h1. */
  subtitle?: React.ReactNode;
  body?: React.ReactNode;
  /** Buttons / links row. */
  actions?: React.ReactNode;
  imageSrc: string;
  imageAlt?: string;
  imagePosition?: string;
  /** Desktop min height of the band, px. */
  minHeight?: number;
  /** "paper" = page paper, "sand" = the warmer contact band. */
  tone?: "paper" | "sand";
  /** "Illustrative aviation imagery" caption on the photo. */
  caption?: string | null;
  /** Extra content under the actions (e.g. a price card). */
  children?: React.ReactNode;
  titleClassName?: string;
};

const FADE = {
  paper: "linear-gradient(90deg,#F7F5F0 0%,rgba(247,245,240,.7) 12%,rgba(247,245,240,0) 32%)",
  sand: "linear-gradient(90deg,#F1EEE6 0%,rgba(241,238,230,.75) 14%,rgba(241,238,230,0) 36%)",
};

/**
 * Split page intro from the light company prototypes (About, Contact,
 * How it works): breadcrumb, eyebrow, serif h1 and copy on the left,
 * aligned with the 1240px container; a full-bleed photo on the right
 * that fades into the paper. Stacks to copy-then-photo on phones.
 */
export function SplitHero({
  crumbs,
  eyebrow,
  title,
  subtitle,
  body,
  actions,
  imageSrc,
  imageAlt = "",
  imagePosition = "center",
  minHeight = 440,
  tone = "paper",
  caption = "Illustrative aviation imagery",
  children,
  titleClassName = "",
}: Props) {
  return (
    <section
      className={[
        "relative grid border-b border-line [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]",
        tone === "sand" ? "bg-[#F1EEE6]" : "bg-ink",
      ].join(" ")}
      style={{ minHeight }}
    >
      <div className="relative z-[1] flex min-w-0 flex-col pb-9 pl-[max(var(--pad-x),calc((100vw-1240px)/2+var(--pad-x)))] pr-[var(--pad-x)] pt-[18px] md:pr-6">
        <Breadcrumb items={crumbs} className="font-serif" />
        {eyebrow ? <p className="eyebrow !mb-0 mt-7 !tracking-[0.2em]">{eyebrow}</p> : null}
        <h1
          className={`mt-[10px] font-serif text-[clamp(34px,9vw,64px)] font-normal leading-none tracking-[-0.02em] ${titleClassName}`}
        >
          {title}
        </h1>
        {subtitle ? <div className="mt-[14px] font-serif text-[clamp(24px,5vw,30px)] leading-[1.15]">{subtitle}</div> : null}
        {body ? <div className="mt-4 max-w-[52ch] text-[15px] leading-[1.55]">{body}</div> : null}
        {actions ? <div className="mt-[22px] flex flex-wrap items-center gap-x-[22px] gap-y-3">{actions}</div> : null}
        {children}
      </div>
      <div
        className="relative bg-surface-2 max-md:!min-h-[260px]"
        style={{ minHeight }}
      >
        <Image
          src={imageSrc}
          alt={imageAlt}
          aria-hidden={imageAlt === "" ? true : undefined}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover"
          style={{ objectPosition: imagePosition }}
        />
        <div aria-hidden className="absolute inset-0 max-md:hidden" style={{ background: FADE[tone] }} />
        {caption ? (
          <span className="absolute bottom-[10px] right-[14px] whitespace-nowrap font-serif text-[12px] text-white [text-shadow:0_1px_2px_rgba(0,0,0,.5)]">
            {caption}
          </span>
        ) : null}
      </div>
    </section>
  );
}
