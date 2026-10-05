import Link from "next/link";
import type { ReactNode } from "react";
import { GUIDE_CHAPTERS, type GuideChapter } from "@/lib/guides";

/**
 * Pieces for the two pricing-guide chapters that render the short-guide
 * template (one-way vs round trip, last-minute): the chapter eyebrow and
 * the prev / next chapter navigation they carried under GuideShell.
 */
export function ChapterEyebrow({ chapter }: { chapter: GuideChapter }) {
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

export function ChapterNav({ chapter }: { chapter: GuideChapter }) {
  const prev = GUIDE_CHAPTERS.find((c) => c.chapter === chapter.chapter - 1);
  const next = GUIDE_CHAPTERS.find((c) => c.chapter === chapter.chapter + 1);
  const prevLink = prev
    ? { href: prev.href, small: `← Chapter ${prev.chapter}`, big: prev.navTitle }
    : { href: "/guides", small: "← All chapters", big: "The charter pricing guide" };
  const nextLink = next
    ? { href: next.href, small: `Chapter ${next.chapter} →`, big: next.navTitle }
    : { href: "/cost-calculator", small: "Put it to work →", big: "Cost calculator" };
  return (
    <nav aria-label="Guide chapters" className="container-jn pb-[30px]">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link href={prevLink.href} className="flex flex-col gap-1 border border-line bg-surface px-5 py-4 transition-colors hover:border-gold">
          <span className="text-[13px] text-steel">{prevLink.small}</span>
          <span className="font-serif text-[20px]">{prevLink.big}</span>
        </Link>
        <Link href={nextLink.href} className="flex flex-col items-end gap-1 border border-line bg-surface px-5 py-4 text-right transition-colors hover:border-gold">
          <span className="text-[13px] text-steel">{nextLink.small}</span>
          <span className="font-serif text-[20px]">{nextLink.big}</span>
        </Link>
      </div>
    </nav>
  );
}

/** A restyled "existing body" block: eyebrow, H2, three numbered cards, a closing paragraph. */
export function ChapterBody({
  eyebrow,
  title,
  cards,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  cards: { n: string; k: string; h: string; p: string }[];
  children: ReactNode;
}) {
  return (
    <section id="mechanics" className="container-jn scroll-mt-[84px] pt-[30px]">
      <p className="eyebrow !mb-0 !tracking-[.2em]">{eyebrow}</p>
      <h2 className="mt-[6px] max-w-[30ch] font-serif text-[32px] leading-[1.1]">{title}</h2>
      <div className="mt-[14px] grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-[10px]">
        {cards.map((c) => (
          <div key={c.n} className="border border-line bg-surface px-[18px] pb-4 pt-[18px]">
            <div className="flex items-baseline gap-3">
              <span className="font-serif text-[30px] text-gold">{c.n}</span>
              <span className="text-[12px] font-bold uppercase tracking-[.14em] text-steel">{c.k}</span>
            </div>
            <h3 className="mt-2 font-serif text-[20px] leading-[1.15]">{c.h}</h3>
            <p className="mt-[6px] text-[14px] leading-[1.55] text-steel">{c.p}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 max-w-[72ch] text-[15px] leading-[1.6] text-bone-2">{children}</p>
    </section>
  );
}
