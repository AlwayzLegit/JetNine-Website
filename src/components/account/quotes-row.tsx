import Link from "next/link";
import { SITE } from "@/lib/constants";
import { BTN_LINE, PANEL } from "./panel";
import { type StatusWords } from "./quotes-status";

type Props = {
  /** `/request/<token>`; when the quote has no status token there is no link. */
  href: string | null;
  title: React.ReactNode;
  /** Line under the title: date · passengers · category. */
  meta?: string | null;
  /** Raw quote status, drives the four-step tracker. */
  status: string;
  /** Status as a sentence. */
  words: StatusWords;
  /** Indicative price range, shown under the buttons. */
  aside?: string | null;
  /** Quote code for the email subject. */
  code?: string | null;
};

const STEPS = ["Received", "Gathering options", "Options sent", "Booked"] as const;

/** Index of the step in progress; 4 = all done; -1 = no tracker (closed / draft). */
function stepIndex(status: string): number {
  switch (status) {
    case "submitted":
      return 0;
    case "triaged":
    case "sourcing":
      return 1;
    case "options_sent":
    case "held":
      return 2;
    case "accepted":
      return 3;
    case "converted":
      return 4;
    default:
      return -1;
  }
}

/**
 * One quote request (Light - Account "Quotes"): serif route, meta line,
 * the four-step tracker, the status sentence; on the right the track /
 * options button, "Message dispatch" and the indicative range.
 */
export function QuoteRow({ href, title, meta, status, words, aside, code }: Props) {
  const at = stepIndex(status);
  const ready = status === "options_sent" || status === "held";
  const subject = code ? `${code} — question` : "Quote request — question";
  return (
    <article
      className={`${PANEL} grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] items-start gap-5 px-5 py-[18px]`}
    >
      <div className="min-w-0">
        <div className="font-serif text-[22px] leading-[1.15] text-bone">{title}</div>
        {meta ? <div className="mt-0.5 text-[14px] text-steel">{meta}</div> : null}
        {at >= 0 ? (
          <ol className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-2" aria-label="Progress">
            {STEPS.map((label, i) => {
              const state = i < at ? "done" : i === at ? "now" : "todo";
              return (
                <li
                  key={label}
                  aria-current={state === "now" ? "step" : undefined}
                  className={["flex items-center gap-1.5 text-[12px]", state === "todo" ? "text-steel-dim" : "text-bone"].join(" ")}
                >
                  <span
                    aria-hidden="true"
                    className={[
                      "h-4 w-4 rounded-full border",
                      state === "done" ? "border-gold bg-gold" : state === "now" ? "border-gold bg-surface-2" : "border-line bg-transparent",
                    ].join(" ")}
                  />
                  {label}
                </li>
              );
            })}
          </ol>
        ) : null}
        <p className="mt-3 text-[14px] text-bone">{words.text}</p>
      </div>
      <div className="flex flex-col gap-2">
        {href ? (
          ready ? (
            <Link
              href={href}
              className="flex h-10 items-center justify-center rounded-control bg-clearance text-[14px] font-bold text-white transition-colors hover:bg-clearance-hover hover:text-white"
            >
              See your options →
            </Link>
          ) : (
            <Link href={href} className={BTN_LINE}>
              Track this request →
            </Link>
          )
        ) : null}
        <a href={`mailto:${SITE.email}?subject=${encodeURIComponent(subject)}`} className={BTN_LINE}>
          Message dispatch
        </a>
        {aside ? <span className="text-center text-[12px] text-steel">Indicative {aside}</span> : null}
      </div>
    </article>
  );
}
