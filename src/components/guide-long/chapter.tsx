import Link from "next/link";
import { GUIDE_CHAPTERS, type GuideChapter } from "@/lib/guides";
import { RATES_UPDATED } from "@/lib/rates";
import { GuideJsonLd } from "./jsonld";

/**
 * Pricing-guide chapter furniture for the light long-form template: the
 * same Article + BreadcrumbList schema the chapters always shipped (series
 * link, "Pricing guide" crumb, 2026-08-31 dates), the byline, and the
 * prev/next chapter navigation.
 */
export function ChapterJsonLd({ chapter }: { chapter: GuideChapter }) {
  return (
    <GuideJsonLd
      title={chapter.title}
      description={chapter.description}
      path={chapter.href}
      crumb={chapter.navTitle}
      datePublished="2026-08-31"
      series={{ name: "The JetNine Charter Pricing Guide", crumb: "Pricing guide" }}
    />
  );
}

export function ChapterKicker({ chapter }: { chapter: GuideChapter }) {
  return (
    <>
      <Link href="/guides" className="hover:text-bone">
        The charter pricing guide
      </Link>
      <span aria-hidden> · </span>
      Chapter {chapter.chapter} of {GUIDE_CHAPTERS.length}
    </>
  );
}

export function Byline({ className = "mt-4" }: { className?: string }) {
  return (
    <p className={`text-[13px] text-steel ${className}`}>
      By the JetNine dispatch desk · Updated {RATES_UPDATED} · Rates reviewed quarterly
    </p>
  );
}

export function ChapterNav({ chapter }: { chapter: GuideChapter }) {
  const prev = GUIDE_CHAPTERS.find((c) => c.chapter === chapter.chapter - 1);
  const next = GUIDE_CHAPTERS.find((c) => c.chapter === chapter.chapter + 1);
  const prevLink = prev
    ? { href: prev.href, small: `← Chapter ${prev.chapter}`, big: prev.navTitle }
    : { href: "/guides", small: "← All guides", big: "The charter pricing guide" };
  const nextLink = next
    ? { href: next.href, small: `Chapter ${next.chapter} →`, big: next.navTitle }
    : { href: "/cost-calculator", small: "Put it to work →", big: "Cost calculator" };
  return (
    <nav aria-label="Guide chapters" className="container-jn pt-10">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link href={prevLink.href} className="flex flex-col gap-1 border border-line bg-white px-5 py-4 text-bone hover:border-gold hover:text-bone">
          <span className="text-[12px] font-bold uppercase tracking-[.16em] text-gold">{prevLink.small}</span>
          <span className="font-serif text-[20px] leading-[1.2]">{prevLink.big}</span>
        </Link>
        <Link
          href={nextLink.href}
          className="flex flex-col items-end gap-1 border border-line bg-white px-5 py-4 text-right text-bone hover:border-gold hover:text-bone"
        >
          <span className="text-[12px] font-bold uppercase tracking-[.16em] text-gold">{nextLink.small}</span>
          <span className="font-serif text-[20px] leading-[1.2]">{nextLink.big}</span>
        </Link>
      </div>
    </nav>
  );
}
