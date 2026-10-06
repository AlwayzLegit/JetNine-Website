import Image from "next/image";
import Link from "next/link";
import { CtaBand } from "@/components/cta-band";
import { Breadcrumb, type Crumb } from "@/components/light/breadcrumb";
import { WindowButton } from "@/components/light/window";
import type { AircraftCategorySlug } from "@/lib/fleet";
import { SITE } from "@/lib/constants";
import { CATEGORY_COPY, CATEGORY_IMAGE, type Neighbor } from "./category-copy";
import { LineIcon, type IconName } from "./line-icon";
import { RouteCheckButton } from "./route-check-button";

// Shared sections of the light category template (Light - Model page),
// reused by the model pages so both read as one family.

export const scrollM = "scroll-mt-[calc(var(--header-h)+16px)]";
export const h2Cls = "font-serif text-[30px] font-normal leading-[1.1]";

/** Split hero: paper text column on the left, photo on the right. */
export function SplitHero({
  crumbs,
  title,
  tagline,
  intro,
  image,
  imageAlt = "",
  actions,
  eyebrow,
}: {
  crumbs: Crumb[];
  title: string;
  tagline: string;
  intro: string;
  image?: string;
  imageAlt?: string;
  actions: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <section className="relative grid min-h-[300px] border-b border-line [grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr))]">
      <div className="relative z-[1] px-[clamp(16px,4vw,32px)] pb-7 pt-[18px] min-[1304px]:pl-[calc((100vw-1240px)/2+32px)]">
        <Breadcrumb items={crumbs} className="font-serif" />
        {eyebrow ? <p className="eyebrow !mb-0 mt-5">{eyebrow}</p> : null}
        <h1 className={`${eyebrow ? "mt-2" : "mt-[22px]"} font-serif text-[clamp(38px,9vw,54px)] font-normal leading-[1.02] tracking-[-.02em]`}>
          {title}
        </h1>
        <p className="mt-2 font-serif text-[26px] italic leading-[1.2] text-gold">{tagline}</p>
        <p className="mt-3 max-w-[50ch] text-[14px] leading-[1.55]">{intro}</p>
        <div className="mt-[18px] flex flex-wrap gap-3">{actions}</div>
      </div>
      <div className="relative min-h-[240px] bg-surface-2">
        {image ? <Image src={image} alt={imageAlt} fill priority sizes="(max-width: 780px) 100vw, 50vw" className="object-cover" /> : null}
        <span className="absolute bottom-[10px] right-[14px] whitespace-nowrap font-serif text-[12px] text-white [text-shadow:0_1px_2px_rgba(0,0,0,.5)]">
          Illustrative aircraft imagery.
        </span>
      </div>
    </section>
  );
}

/** "At a glance" strip: icon, bold value, muted label. */
export function GlanceBand({ items }: { items: { icon: IconName; k: string; v: string }[] }) {
  return (
    <section aria-label="At a glance" className="border-b border-line bg-surface">
      <dl className="container-jn grid gap-y-[10px] py-[14px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr))]">
        {items.map((f, i) => (
          <div key={f.v + f.k} className={`flex items-center gap-[14px] px-5 py-1 max-sm:px-0 ${i ? "border-l border-line max-sm:border-l-0" : ""}`}>
            <LineIcon name={f.icon} size={28} />
            <div className="flex flex-col-reverse">
              <dt className="text-[13px] text-steel">{f.v}</dt>
              <dd className="text-[15px] font-bold">{f.k}</dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** In-main section tabs (serif, bronze underline on the first). */
export function SectionTabs({ tabs }: { tabs: [string, string][] }) {
  return (
    <nav aria-label="Sections" className="flex gap-[18px] overflow-x-auto whitespace-nowrap border-b border-line pb-2 font-serif text-[14px]">
      {tabs.map(([label, href], i) => (
        <a key={href} href={href} className={`border-b pb-1 hover:text-gold ${i === 0 ? "border-gold" : "border-transparent"}`}>
          {label}
        </a>
      ))}
    </nav>
  );
}

/** "On this page" rail under the side form. */
export function PageRail({ items }: { items: [string, string][] }) {
  return (
    <nav aria-label="On this page" className="border border-line bg-surface px-[18px] py-4">
      <div className="font-serif text-[17px]">On this page</div>
      {items.map(([label, href]) => (
        <a key={href} href={href} className="flex items-center gap-[10px] py-1 text-[13px] hover:text-gold">
          <span aria-hidden="true" className="text-[12px] text-gold">
            ▸
          </span>
          {label}
        </a>
      ))}
    </nav>
  );
}

/** Numbered trip-fit tiles with a divider caveat line. */
export function FitTiles({ title, items, caveat }: { title: string; items: { title: string; body: string; icon: IconName }[]; caveat?: string }) {
  return (
    <section id="fit" className={`pt-[22px] ${scrollM}`}>
      <h2 className="font-serif text-[32px] font-normal leading-[1.1]">{title}</h2>
      <div className={`mt-4 grid gap-y-[18px] ${items.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {items.map((f, i) => (
          <div
            key={f.title}
            className={`grid grid-cols-[auto_auto_minmax(0,1fr)] items-start gap-3 pr-[18px] ${
              (items.length === 3 ? i > 0 : i % 2 === 1) ? "sm:border-l sm:border-line sm:pl-[18px]" : ""
            }`}
          >
            <span className="font-serif text-[24px] leading-[1.1] text-gold">{String(i + 1).padStart(2, "0")}</span>
            <LineIcon name={f.icon} size={26} className="mt-0.5" />
            <div>
              <div className="text-[15px] font-bold">{f.title}</div>
              <p className="mt-1 text-[13px] leading-[1.45] text-steel">{f.body}</p>
            </div>
          </div>
        ))}
      </div>
      {caveat ? (
        <div className="mt-4 flex items-center gap-[14px] text-[13px] text-steel">
          <span aria-hidden="true" className="h-px flex-[0_0_28px] bg-line" />
          <span>{caveat}</span>
          <span aria-hidden="true" className="h-px flex-1 bg-line" />
        </div>
      ) : null}
    </section>
  );
}

/** "Can your … fly nonstop?" — factors, route check, tip box. */
export function RangeSection({
  title,
  sub,
  tip,
  category,
  context,
  children,
}: {
  title: string;
  sub: string;
  tip: string;
  category: AircraftCategorySlug;
  context: string;
  children?: React.ReactNode;
}) {
  const factors: [string, IconName][] = [
    ["Passenger & baggage load", "people"],
    ["Wind and routing", "wind"],
    ["Fuel reserves", "fuel"],
    ["Runway and weather", "warn"],
  ];
  return (
    <section id="range" className={`container-jn pt-6 ${scrollM}`}>
      <div className="grid items-start gap-7 [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))]">
        <div>
          <h2 className={h2Cls}>{title}</h2>
          <p className="mt-1 text-[13px] text-steel">{sub}</p>
          <div className="mt-[14px] grid grid-cols-2 gap-y-[10px]">
            {factors.map(([label, icon], i) => (
              <div key={label} className={`flex items-center gap-[10px] px-[14px] py-1 text-[13px] ${i % 2 ? "border-l border-line" : "pl-0"}`}>
                <LineIcon name={icon} size={26} />
                {label}
              </div>
            ))}
          </div>
          <RouteCheckButton
            label="Check my route →"
            context={context}
            category={category}
            className="mt-[14px] border-0 border-b border-bone bg-transparent p-0 pb-px text-[13px] text-bone hover:text-gold"
          />
        </div>
        <div className="grid grid-cols-[30px_minmax(0,1fr)] gap-[14px] bg-surface-2 px-[18px] py-4 text-[13px] leading-[1.5]">
          <LineIcon name="plane" size={28} />
          <span>{tip}</span>
        </div>
      </div>
      {children}
    </section>
  );
}

/** Neighbour category cards (thumbnail + name + body). */
export function NeighborCards({ items }: { items: (Neighbor & { href: string; image: string; cta?: string })[] }) {
  return (
    <div className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
      {items.map((n) => (
        <Link key={n.href + n.name} href={n.href} className="group grid grid-cols-[110px_minmax(0,1fr)] gap-3 border border-line bg-surface p-[10px] hover:border-gold">
          <span className="relative block aspect-[4/3] overflow-hidden bg-surface-2">
            <Image src={n.image} alt="" fill sizes="110px" className="object-cover" />
          </span>
          <span>
            <span className="block font-serif text-[18px]">{n.name}</span>
            <span className="mt-0.5 block text-[12px] leading-[1.4] text-steel">{n.body}</span>
            <span className="mt-1.5 inline-block border-b border-bone text-[12px] group-hover:text-gold">{n.cta ?? `Explore ${n.name.toLowerCase()}`} →</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

export function neighborsFor(slug: AircraftCategorySlug) {
  const n = CATEGORY_COPY[slug].neighbors;
  return [n.prev, n.next]
    .filter((x): x is Neighbor => Boolean(x))
    .map((x) => ({ ...x, href: `/aircraft/${x.slug}`, image: CATEGORY_IMAGE[x.slug] }));
}

/** Cost checklist column. */
export function CostList({ title, items }: { title: string; items: [string, IconName][] }) {
  return (
    <div>
      <h2 className="font-serif text-[28px] font-normal leading-[1.1]">{title}</h2>
      <p className="mt-1 text-[13px] text-steel">Compare the complete itinerary — not the hourly figure alone.</p>
      <ul className="mt-[10px]">
        {items.map(([label, icon]) => (
          <li key={label} className="flex items-center gap-3 border-t border-line py-2 text-[14px]">
            <LineIcon name={icon} size={20} />
            {label}
          </li>
        ))}
      </ul>
      <Link href="/guides/private-jet-charter-cost" className="mt-2 inline-block whitespace-nowrap border-b border-bone pb-px text-[13px] hover:text-gold">
        Read the charter pricing guide →
      </Link>
    </div>
  );
}

/** Compare window behind the hero's secondary button. */
export function CompareWindowButton({ slug, label }: { slug: AircraftCategorySlug; label: string }) {
  const c = CATEGORY_COPY[slug];
  const cards = [
    ...(c.neighbors.prev ? [{ ...c.neighbors.prev, self: false }] : []),
    { slug, name: c.name, body: c.compareBody, self: true },
    ...(c.neighbors.next ? [{ ...c.neighbors.next, self: false }] : []),
  ];
  return (
    <WindowButton
      label={<>{label} →</>}
      className="inline-flex h-[42px] items-center gap-[10px] rounded-[2px] border border-bone bg-transparent px-5 text-[14px] text-bone hover:bg-surface-2"
      title="Which cabin fits your trip?"
      width={760}
    >
      <div className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,160px),1fr))]">
        {cards.map((k) => (
          <div key={k.slug} className={`border p-3 ${k.self ? "border-gold bg-surface" : "border-line bg-white"}`}>
            <span className="relative block aspect-[16/9] overflow-hidden bg-surface-2">
              <Image src={CATEGORY_IMAGE[k.slug]} alt="" fill sizes="200px" className="object-cover" />
            </span>
            <h3 className="mt-3 font-serif text-[22px] font-normal">{k.name}</h3>
            <p className="mb-[10px] mt-1 font-serif text-[14px] leading-[1.45] text-steel">{k.body}</p>
            {k.self ? (
              <span className="font-serif text-[13px] text-steel">You are here</span>
            ) : (
              <Link href={`/aircraft/${k.slug}`} className="whitespace-nowrap border-b border-bone font-serif text-[14px] hover:text-gold">
                Explore {k.name.toLowerCase()} →
              </Link>
            )}
          </div>
        ))}
      </div>
      <div className="mt-[14px] flex flex-wrap items-center justify-between gap-4 bg-surface-2 px-4 py-3">
        <span className="flex items-center gap-[10px] text-[13px]">
          <LineIcon name="scale" size={22} />
          Use the same route, dates, passengers and baggage when comparing. Confirm the actual aircraft.
        </span>
        <Link href="/aircraft#compare" className="btn btn-primary">
          Compare all categories →
        </Link>
      </div>
    </WindowButton>
  );
}

/** Related links row under the FAQ. */
export function RelatedRow() {
  return (
    <div className="mt-[14px] flex flex-wrap items-center gap-x-[22px] gap-y-2 text-[13px]">
      <span className="text-[12px] font-bold uppercase tracking-[.2em] text-gold">Related</span>
      {[
        ["All aircraft", "/aircraft"],
        ["How booking works", "/how-it-works"],
        ["Safety questions", "/safety"],
        ["Contact", "/contact"],
      ].map(([l, h]) => (
        <Link key={h} href={h} className="whitespace-nowrap border-b border-bone hover:text-gold">
          {l} →
        </Link>
      ))}
    </div>
  );
}

/** Closing navy band over a photo. */
export function TemplateCta({ title, image, cta }: { title: string; image: string; cta: string }) {
  return (
    <CtaBand
      className="!mt-[22px]"
      title={title}
      body="Share your route, dates, passengers and baggage."
      imageSrc={image}
      primary={{ label: cta, href: "/quote/mission" }}
      secondary={{ label: `Call dispatch · ${SITE.dispatchPhone}`, href: `tel:${SITE.dispatchPhoneE164}` }}
    />
  );
}
