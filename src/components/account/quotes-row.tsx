import Link from "next/link";
import { dotClass, type StatusWords } from "./quotes-status";

type Props = {
  /** `/request/<token>`; when the quote has no status token the row is static. */
  href: string | null;
  title: React.ReactNode;
  /** Second line under the title, before the status sentence. */
  meta?: string | null;
  status: StatusWords;
  /** Right-hand column (e.g. an indicative price range). */
  aside?: string | null;
  /** Right-hand call to action, default "Track →". */
  cta?: string;
};

/**
 * One quote request as a card row (Account.dc.html "Quotes · submitted &
 * in progress"): title 17px 500, optional meta line, a dot + status
 * sentence, "Track →" on the right.
 */
export function QuoteRow({ href, title, meta, status, aside, cta = "Track →" }: Props) {
  const body = (
    <>
      <div className="min-w-0">
        <div className="text-[17px] font-medium text-bone">{title}</div>
        {meta ? <div className="mt-0.5 text-[15px] text-bone-2">{meta}</div> : null}
        <div className="mt-1 flex items-center gap-2 text-[15px] text-bone-2">
          <span className={dotClass(status.tone)} aria-hidden="true" />
          <span>{status.text}</span>
        </div>
      </div>
      <div className="flex items-center gap-4 text-[15px] text-bone-2 max-md:justify-between">
        {aside ? <span className="text-bone">{aside}</span> : null}
        {href ? <span className="whitespace-nowrap">{cta}</span> : null}
      </div>
    </>
  );
  const cls = "card grid items-center gap-4 px-6 py-[18px] max-md:px-4 md:grid-cols-[minmax(0,1fr)_auto]";
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
