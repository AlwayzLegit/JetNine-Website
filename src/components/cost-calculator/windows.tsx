import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";

// Window bodies from jn-pack-windows.js (V.faa, V.nbaa, V.taxes, V.extras)
// for the cost calculator. Content only — the LightWindow supplies the
// title, sub and close button, so these render beneath them.

export const SOURCE_URLS = {
  faa: "https://www.faa.gov/about/initiatives/safecharteroperations/thinking-chartering-aircraft",
  nbaa: "https://nbaa.org/flight-department-administration/aircraft-operating-ownership-options/aircraft-charter/request-for-proposals-aircraft-charter/",
  irs: "https://www.irs.gov/publications/p510",
} as const;

export function Small({ children }: { children: ReactNode }) {
  return <p className="mt-[10px] text-[12px] leading-[1.45] text-steel">{children}</p>;
}

export function Notice({ children, icon = "info" }: { children: ReactNode; icon?: IconName }) {
  return (
    <div className="flex items-start gap-[10px] rounded-[3px] border border-line bg-[#FBFAF7] px-3 py-[10px] text-[13px] leading-[1.45]">
      <Icon name={icon} size={18} />
      <span>{children}</span>
    </div>
  );
}

function OutLink({ href, children, primary }: { href: string; children: ReactNode; primary?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`btn btn-sm ${primary ? "!border-gold !bg-gold !text-white hover:!opacity-90" : "btn-secondary bg-white"}`}
    >
      {children}
    </a>
  );
}

function Numbered({ items }: { items: [string, string][] }) {
  return (
    <ol className="mt-[10px] flex flex-col gap-3">
      {items.map(([t, b], i) => (
        <li key={t} className="grid grid-cols-[28px_minmax(0,1fr)] items-start gap-3 text-[14px]">
          <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full border border-gold text-[12px] font-bold text-gold">
            {i + 1}
          </span>
          <span>
            <b className="block">{t}</b>
            <span className="text-[13px] text-steel">{b}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function Row({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <div className="grid grid-cols-[26px_minmax(0,1fr)] items-start gap-3 rounded-[3px] border border-line bg-white px-[14px] py-3">
      <Icon name={icon} />
      <span>
        <b className="block text-[14px]">{title}</b>
        <span className="text-[13px] text-steel">{body}</span>
      </span>
    </div>
  );
}

/** V.faa as a modal: know who operates your flight. */
export function FaaWindow() {
  return (
    <>
      <div className="relative mt-[14px] aspect-[16/6] overflow-hidden bg-surface-2">
        <Image src="/images/light/jet-ultra-flight.webp" alt="" fill sizes="600px" className="object-cover" />
      </div>
      <Numbered
        items={[
          ["Ask for the operating carrier name.", "Confirm the company that will operate your flight."],
          ["Request the air carrier or operating certificate.", "Ask for the operator’s FAA air carrier or operating certificate number."],
          ["Confirm aircraft authorization for charter.", "Verify the aircraft is authorized for the type of operation you are booking."],
        ]}
      />
      <div className="mt-[14px]">
        <Notice icon="shield">JetNine arranges flights. Ask for the operating carrier details before booking.</Notice>
      </div>
      <Small>FAA guidance is an independent reference, not an endorsement of JetNine.</Small>
      <div className="mt-[14px] flex flex-wrap items-center gap-3">
        <OutLink href={SOURCE_URLS.faa} primary>
          Read original FAA guidance <span aria-hidden="true">↗</span>
        </OutLink>
        <span className="text-[12px] text-steel">faa.gov</span>
      </div>
    </>
  );
}

const NBAA_FLIGHT: [IconName, string, string][] = [
  ["plane", "Operating carrier and aircraft", "Confirm the carrier, aircraft model and configuration."],
  ["people", "Cabin and baggage fit", "Check that the cabin, baggage space and amenities meet your needs."],
  ["doc", "Substitution policy", "Understand when and why the aircraft may be substituted."],
];
const NBAA_PRICE: [IconName, string, string][] = [
  ["dollar", "Total trip price and taxes", "Review what is included in the total price."],
  ["info", "Potential extra charges", "Ask about likely additional costs (e.g. landing fees, handling, catering)."],
  ["calendar", "Cancellation and refund terms", "Check the policy and timing for changes or cancellations."],
];

/** V.nbaa: compare the whole proposal. */
export function NbaaWindow() {
  return (
    <>
      <div className="mt-4 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
        {(
          [
            ["Flight details", NBAA_FLIGHT],
            ["Price & terms", NBAA_PRICE],
          ] as const
        ).map(([t, list]) => (
          <div key={t} className="rounded-[3px] border border-line bg-[#FBFAF7] px-[14px] py-3">
            <p className="mb-1 font-serif text-[18px]">{t}</p>
            {list.map(([, title, body]) => (
              <div key={title} className="grid grid-cols-[22px_minmax(0,1fr)] gap-[10px] py-2">
                <Icon name="check" size={20} />
                <span>
                  <b className="block text-[13px]">{title}</b>
                  <span className="text-[12px] leading-[1.4] text-steel">{body}</span>
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-[14px]">
        <Notice>Ask what is included, what could change, and when the price is confirmed.</Notice>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/guides/private-jet-charter-cost" className="text-link text-[13px] font-bold">
          JetNine pricing guide →
        </Link>
        <span className="flex items-center gap-[10px]">
          <OutLink href={SOURCE_URLS.nbaa} primary>
            Read NBAA charter checklist <span aria-hidden="true">↗</span>
          </OutLink>
          <span className="text-[12px] text-steel">nbaa.org</span>
        </span>
      </div>
      <Small>Independent guidance. No endorsement implied.</Small>
    </>
  );
}

/** V.taxes: taxes and airport charges. */
export function TaxesWindow({ footer }: { footer?: ReactNode }) {
  return (
    <>
      <div className="mt-4 flex flex-col gap-[10px]">
        <Row icon="doc" title="Applicable air travel taxes" body="Ask which taxes apply to your itinerary and where they appear in the total." />
        <Row icon="plane" title="Airport and terminal fees" body="Confirm landing, handling and parking charges." />
        <Row icon="globe" title="International services" body="Ask about permits, customs and handling where applicable." />
      </div>
      <div className="mt-[14px] grid grid-cols-[30px_minmax(0,1fr)] gap-3 border border-line bg-[#FBFAF7] px-4 py-[14px]">
        <Icon name="book" size={28} />
        <div>
          <b className="block text-[14px]">IRS · Publication 510</b>
          <span className="mb-2 mt-[2px] block text-[12px] text-steel">Official guidance on air transportation taxes.</span>
          <a href={SOURCE_URLS.irs} target="_blank" rel="noopener noreferrer" className="text-link text-[13px] font-bold">
            Read IRS guidance <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
      {footer ? <div className="mt-4 border-t border-line pt-3">{footer}</div> : null}
    </>
  );
}

const EXTRAS: [IconName, string, string, string][] = [
  [
    "cloud",
    "Weather-related services",
    "Ask how de-icing or weather changes are charged.",
    "These services may be charged separately depending on routing, season and airport. Confirm when and how they appear in your proposal.",
  ],
  [
    "gear",
    "Optional upgrades",
    "Confirm catering, ground transport and special requests.",
    "Items such as catering, ground transportation and special requests may be available for an additional charge. Check how each item is described in the total.",
  ],
  [
    "calendar",
    "Changes & cancellation",
    "Check deadlines, fees, refund terms and aircraft substitution.",
    "Confirm the timeline for changes, any fees that may apply, refund terms and whether an alternate aircraft may be provided.",
  ],
];

/** V.extras: before you accept the quote. Items are always expanded. */
export function ExtrasWindow({ footer }: { footer?: ReactNode }) {
  return (
    <>
      <div className="mt-4 flex flex-col gap-[10px]">
        {EXTRAS.map(([icon, t, b, body]) => (
          <div key={t} className="rounded-[3px] border border-line bg-white">
            <div className="grid grid-cols-[26px_minmax(0,1fr)] items-center gap-3 px-[14px] py-3">
              <Icon name={icon} />
              <span>
                <b className="block text-[14px]">{t}</b>
                <span className="text-[12px] text-steel">{b}</span>
              </span>
            </div>
            <div className="mx-[14px] mb-3 rounded-[3px] bg-[#FBFAF7] px-3 py-[10px] text-[13px] leading-[1.5] sm:ml-[52px]">{body}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-[26px_minmax(0,1fr)] gap-3 rounded-[3px] bg-surface-2 px-[14px] py-3">
        <Icon name="doc" />
        <span>
          <b className="text-[13px]">Included · Excluded · Charged if used</b>
          <span className="block text-[12px] text-steel">Each item should have a clear status in your written proposal.</span>
        </span>
      </div>
      {footer ? <div className="mt-[14px]">{footer}</div> : null}
    </>
  );
}
