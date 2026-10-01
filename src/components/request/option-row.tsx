import Image from "next/image";
import { ChooseButton } from "./choose-button";
import {
  CATEGORY_IMAGE,
  CATEGORY_PLAIN,
  USD,
  formatMinutes,
  type RequestOption,
} from "@/lib/request-page";

export function OptionRow({
  option,
  token,
  recommended,
  tripWords,
  chosen,
  open,
}: {
  option: RequestOption;
  token: string;
  recommended: boolean;
  tripWords: string;
  chosen: boolean;
  /** Whether the client can still choose (quote open for choices). */
  open: boolean;
}) {
  const kind = option.category ? CATEGORY_PLAIN[option.category] ?? option.category : "Aircraft";
  const img = option.category ? CATEGORY_IMAGE[option.category] : undefined;
  const facts = [
    kind,
    option.paxCapacity ? `seats ${option.paxCapacity}` : null,
    option.totalFlightTimeMin ? `${formatMinutes(option.totalFlightTimeMin)} in the air` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const notes = [option.yearOfMake ? `Built ${option.yearOfMake}` : null, "Vetted FAA Part 135 operator"]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      className={[
        "card grid items-center gap-6 p-5 md:grid-cols-[200px_1fr_auto]",
        chosen ? "card-selected" : "",
      ].join(" ")}
    >
      <div className="aspect-[4/3] overflow-hidden rounded-control bg-surface-2">
        {img ? (
          <Image src={img} alt="" width={400} height={300} className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div>
        {chosen ? (
          <span className="mb-2 inline-block text-[13px] font-semibold text-success">Your choice</span>
        ) : recommended ? (
          <span className="mb-2 inline-block text-[13px] font-semibold text-gold">Our suggestion</span>
        ) : null}
        <h3 className="text-[22px] font-medium leading-tight text-bone">
          {option.aircraftType ?? kind}
        </h3>
        <p className="mt-1 text-bone-2">{facts}</p>
        <p className="mt-2 text-[15px] text-steel">{notes}</p>
      </div>
      <div className="md:text-right">
        <div className="font-serif text-[32px] font-light leading-none text-bone">
          {USD.format(option.clientPriceUsd)}
        </div>
        <div className="mt-1 text-[14px] text-steel">total, {tripWords}</div>
        {open && !chosen ? (
          <ChooseButton
            token={token}
            optionId={option.id}
            primary={recommended}
            label={recommended ? "Choose this one" : "Choose"}
          />
        ) : null}
      </div>
    </article>
  );
}
