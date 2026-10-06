import Link from "next/link";
import { WindowButton } from "@/components/light/window";
import { FAA_URL, NBAA_URL } from "./category-copy";
import { LineIcon, type IconName } from "./line-icon";

const extLink = "text-link whitespace-nowrap text-[13px] font-bold";

function Numbered({ items }: { items: [string, string][] }) {
  return (
    <ol className="mt-4">
      {items.map(([t, b], i) => (
        <li key={t} className="grid grid-cols-[30px_minmax(0,1fr)] gap-3 border-t border-line py-3">
          <span className="font-serif text-[22px] leading-none text-gold">{String(i + 1).padStart(2, "0")}</span>
          <span>
            <b className="block text-[14px]">{t}</b>
            <span className="text-[13px] text-steel">{b}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function Notice({ icon = "shield", children }: { icon?: IconName; children: React.ReactNode }) {
  return (
    <div className="mt-4 grid grid-cols-[24px_minmax(0,1fr)] gap-3 bg-surface-2 px-4 py-3 text-[13px] leading-[1.5]">
      <LineIcon name={icon} size={20} />
      <span>{children}</span>
    </div>
  );
}

/** JNP "faa": verify the operating carrier. */
export function FaaContent() {
  return (
    <>
      <Numbered
        items={[
          ["Who operates my flight?", "Ask for the name of the operating carrier — the air carrier that will operate your flight."],
          ["Can I see the air carrier certificate?", "Request the carrier’s FAA Air Carrier Certificate and confirm it is current."],
          ["Is this aircraft authorized for charter?", "Confirm the aircraft is authorized for on-demand charter operation under the carrier’s certificate."],
        ]}
      />
      <Notice>JetNine arranges flights. Ask for the operating carrier details before booking.</Notice>
      <p className="mt-3 text-[12px] text-steel">FAA guidance is an independent reference, not an endorsement of JetNine.</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <a href={FAA_URL} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
          Read original FAA guidance <span aria-hidden="true">↗</span>
        </a>
        <span className="text-[12px] text-steel">faa.gov</span>
      </div>
    </>
  );
}

/** JNP "nbaa": compare the whole proposal. */
export function NbaaContent() {
  const cols: [string, [IconName, string, string][]][] = [
    [
      "Flight details",
      [
        ["plane", "Operating carrier and aircraft", "Confirm the carrier, aircraft model and configuration."],
        ["seat", "Cabin and baggage fit", "Check that the cabin, baggage space and amenities meet your needs."],
        ["doc", "Substitution policy", "Understand when and why the aircraft may be substituted."],
      ],
    ],
    [
      "Price & terms",
      [
        ["coins", "Total trip price and taxes", "Review what is included in the total price."],
        ["warn", "Potential extra charges", "Ask about likely additional costs (e.g. landing fees, handling, catering)."],
        ["calendar", "Cancellation and refund terms", "Check the policy and timing for changes or cancellations."],
      ],
    ],
  ];
  return (
    <>
      <div className="mt-4 grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
        {cols.map(([t, list]) => (
          <div key={t}>
            <p className="eyebrow !mb-1">{t}</p>
            {list.map(([, title, body]) => (
              <div key={title} className="grid grid-cols-[24px_minmax(0,1fr)] gap-3 border-t border-line py-[10px]">
                <LineIcon name="check" size={20} />
                <span>
                  <b className="block text-[14px]">{title}</b>
                  <span className="text-[13px] text-steel">{body}</span>
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <Notice icon="doc">Ask what is included, what could change, and when the price is confirmed.</Notice>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/guides/private-jet-charter-cost" className={extLink}>
          JetNine pricing guide →
        </Link>
        <a href={NBAA_URL} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
          Read NBAA charter checklist <span aria-hidden="true">↗</span>
        </a>
      </div>
      <p className="mt-3 text-[12px] text-steel">Independent guidance. No endorsement implied.</p>
    </>
  );
}

/** JNM "sources" drawer: manufacturer, FAA and NBAA references. */
export function SourcesDrawerContent({ models }: { models: { name: string; label: string; href: string }[] }) {
  const blocks: [string, string, React.ReactNode][] = [
    [
      "Manufacturer information",
      `Read the matching model’s cabin and performance assumptions for ${models.map((m) => m.name).join(", ")}.`,
      <span key="m" className="flex flex-wrap gap-x-3 gap-y-1">
        {models.map((m) => (
          <a key={m.name} href={m.href} target="_blank" rel="noopener noreferrer" className="text-link whitespace-nowrap text-[13px]">
            {m.label} ↗
          </a>
        ))}
      </span>,
    ],
    [
      "FAA",
      "Ask for the operating carrier’s certificate and aircraft charter authorization.",
      <a key="f" href={FAA_URL} target="_blank" rel="noopener noreferrer" className="text-link whitespace-nowrap text-[13px]">
        Read charter guidance ↗
      </a>,
    ],
    [
      "NBAA",
      "Compare total pricing, additional charges and cancellation terms.",
      <a key="n" href={NBAA_URL} target="_blank" rel="noopener noreferrer" className="text-link whitespace-nowrap text-[13px]">
        Open the checklist ↗
      </a>,
    ],
  ];
  return (
    <>
      {blocks.map(([t, b, l]) => (
        <div key={t} className="mt-[14px] border border-line bg-surface px-4 py-[14px]">
          <div className="font-serif text-[18px]">{t}</div>
          <p className="mb-2 mt-1 text-[13px] leading-[1.5] text-steel">{b}</p>
          {l}
        </div>
      ))}
    </>
  );
}

/**
 * "Verify the details at the source." — the category/model template's
 * tinted band of three source cards, each opening the sources drawer.
 */
export function SourceCards({ models }: { models: { name: string; label: string; href: string }[] }) {
  const cards: [string, string, string, IconName][] = [
    ["Manufacturer information", "Read the matching model’s cabin and performance assumptions.", models[0]?.label ?? "Manufacturer details", "gear"],
    ["FAA", "Ask for the operating carrier’s certificate and aircraft charter authorization.", "Read charter guidance", "shield"],
    ["NBAA", "Compare total pricing, additional charges and cancellation terms.", "Open the checklist", "doc"],
  ];
  return (
    <section id="sources" className="mt-[26px] scroll-mt-[calc(var(--header-h)+16px)] border-y border-line bg-surface-2">
      <div className="container-jn pb-5 pt-[18px]">
        <h2 className="font-serif text-[24px] font-normal leading-[1.1]">Verify the details at the source.</h2>
        <div className="mt-3 grid items-stretch gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
          {cards.map(([title, body, link, icon]) => (
            <div key={title} className="grid grid-cols-[30px_minmax(0,1fr)] gap-3 border border-line bg-surface px-4 py-[14px]">
              <LineIcon name={icon} size={26} />
              <div>
                <div className="text-[14px] font-bold">{title}</div>
                <p className="mb-2 mt-1 text-[12px] leading-[1.45] text-steel">{body}</p>
                <WindowButton
                  label={<>{link} ↗</>}
                  className="border-0 border-b border-bone bg-transparent p-0 pb-px text-left text-[12px] text-bone hover:text-gold"
                  title="Verify the details at the source."
                  sub="Independent information. Source links do not imply endorsement."
                  variant="drawer"
                >
                  <SourcesDrawerContent models={models} />
                </WindowButton>
              </div>
            </div>
          ))}
          <div className="flex items-center px-2 text-[12px] leading-[1.45] text-steel">
            Independent information. Source links do not imply endorsement.
          </div>
        </div>
      </div>
    </section>
  );
}
