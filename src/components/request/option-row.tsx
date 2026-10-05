import Image from "next/image";
import { ChooseButton } from "./choose-button";
import { SITE } from "@/lib/constants";
import {
  CATEGORY_IMAGE,
  CATEGORY_PLAIN,
  USD,
  formatMinutes,
  type RequestOption,
} from "@/lib/request-page";

/**
 * One aircraft option (Your request.dc): photo on the left, bronze
 * category tag, serif aircraft name, the plain facts, then a rule and the
 * serif total with "Ask a question" and "Choose this aircraft". Wraps to
 * one column on phones. The recommended option gets a bronze border.
 */
export function OptionRow({
  option,
  token,
  recommended,
  tripWords,
  chosen,
  open,
  code,
}: {
  option: RequestOption;
  token: string;
  recommended: boolean;
  tripWords: string;
  chosen: boolean;
  /** Whether the client can still choose (quote open for choices). */
  open: boolean;
  /** Quote code, for the "Ask a question" email subject. */
  code?: string;
}) {
  const kind = option.category ? CATEGORY_PLAIN[option.category] ?? option.category : "Aircraft";
  const img = option.category ? CATEGORY_IMAGE[option.category] : undefined;
  const name = option.aircraftType ?? kind;
  const tag = [kind, option.paxCapacity ? `seats ${option.paxCapacity}` : null].filter(Boolean).join(" · ");
  const flying = formatMinutes(option.totalFlightTimeMin);
  const highlight = chosen || recommended;
  const askSubject = `${code ? `${code} — ` : ""}Question about the ${name}`;

  return (
    <article
      className={[
        "flex flex-wrap gap-[18px] rounded-[3px] border bg-surface p-3",
        highlight ? "border-gold shadow-[0_0_0_1px_var(--gold)]" : "border-line",
      ].join(" ")}
    >
      <div className="relative aspect-[16/10] min-w-0 max-w-full flex-[1_1_150px] overflow-hidden bg-surface-2">
        {img ? (
          <Image src={img} alt="" fill sizes="(max-width: 640px) 100vw, 260px" className="object-cover" />
        ) : null}
      </div>
      <div className="min-w-0 flex-[999_1_240px] py-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[12px] font-bold uppercase tracking-[0.2em] text-gold">{tag}</span>
          {chosen ? (
            <span className="bg-surface-2 px-2 py-0.5 text-[12px] font-bold text-success">Your choice</span>
          ) : recommended ? (
            <span className="bg-surface-2 px-2 py-0.5 text-[12px] font-bold text-gold">Our suggestion</span>
          ) : null}
        </div>
        <h3 className="mt-1 font-serif text-[24px] leading-[1.1] text-bone">{name}</h3>
        <p className="mt-1 text-[13px] text-steel">
          {[kind, option.paxCapacity ? `${option.paxCapacity} seats` : null, option.yearOfMake ? `built ${option.yearOfMake}` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="mt-2.5 text-[12px] text-steel">Operated by a vetted FAA Part 135 operator</p>
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
          <div>
            <div className="font-serif text-[30px] leading-none text-bone">{USD.format(option.clientPriceUsd)}</div>
            <div className="mt-1 text-[12px] text-steel">
              total, {tripWords}
              {flying ? ` · ${flying} flying` : ""}
            </div>
          </div>
          {open && !chosen ? (
            <div className="flex flex-wrap items-start gap-2 max-sm:w-full">
              <a
                href={`mailto:${SITE.email}?subject=${encodeURIComponent(askSubject)}`}
                className="btn btn-sm btn-secondary !border-line !font-normal max-sm:w-full"
              >
                Ask a question
              </a>
              <ChooseButton token={token} optionId={option.id} primary label="Choose this aircraft" />
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
