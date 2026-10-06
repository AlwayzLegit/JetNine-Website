"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  isAircraftComplete,
  isMissionComplete,
  useQuoteStore,
  type CabinFlags,
} from "@/lib/quote-store";
import { IndicativeRange, TripSummaryBar } from "@/components/quote/trip-summary";
import { PanelHeader, PanelLabel, QuotePanel } from "@/components/quote/quote-panel";
import { StepFooter } from "@/components/quote/step-footer";
import { CollapsibleSection } from "@/components/quote/collapsible-section";
import { StoreHydrationGate } from "@/components/quote/store-hydration";
import { FLEET, type AircraftCategorySlug } from "@/lib/fleet";
import { recommendCategory, type CateringTier, type GroundType } from "@/lib/quote-pricing";

const CABIN_TOGGLES: { key: keyof CabinFlags; name: string; desc: string }[] = [
  { key: "wifi", name: "Wi-Fi", desc: "Gogo Avance L5 or better, on most cabins" },
  { key: "attendant", name: "Flight attendant", desc: "Standard on heavy & ultra long range, available on midsize+" },
  { key: "lavatory", name: "Enclosed lavatory", desc: "Standard on midsize+, optional on light" },
  { key: "standup", name: "Stand-up cabin", desc: "Midsize and larger only" },
  { key: "lieflat", name: "Lie-flat seating", desc: "Available on heavy & ultra-long-range aircraft" },
  { key: "pet", name: "Pet-friendly", desc: "In-cabin, no carrier — confirmed at booking" },
];

const CATERING: { id: CateringTier; name: string; price: string; desc: string }[] = [
  { id: "standard", name: "Standard", price: "Included", desc: "Cold platters, snacks, soft drinks, coffee & tea." },
  { id: "plus", name: "Plus", price: "+$180/leg", desc: "Hot meal options, fresh fruit, premium snacks, full bar." },
  { id: "premium", name: "Premium", price: "+$450/leg", desc: "Chef-prepared menu from a partner restaurant. Choice of 3 entrées." },
  { id: "custom", name: "Custom", price: "Quoted", desc: "Your own menu, your own caterer, your own dietary specs." },
];

const GROUND: { id: GroundType; name: string; short: string; desc: string }[] = [
  { id: "none", name: "None — I’ve got it", short: "None — self-arrange", desc: "No ground transport at any leg." },
  { id: "sedan", name: "Black sedan", short: "Black sedan", desc: "One vehicle per leg, professional chauffeur. ~$180/leg." },
  { id: "suv", name: "SUV / Sprinter", short: "SUV / Sprinter", desc: "For groups or extra baggage. From ~$280/leg." },
];

const EXTRAS: { k: "kids" | "pets" | "bags"; name: string; desc: string; max: number; one: string; many: string }[] = [
  { k: "kids", name: "Children", desc: "Under 12, with car-seat as needed", max: 8, one: "child", many: "children" },
  { k: "pets", name: "Pets", desc: "In cabin, no carrier required", max: 4, one: "pet", many: "pets" },
  { k: "bags", name: "Extra bags", desc: "Beyond 1 carry-on + 1 checked per passenger", max: 12, one: "extra bag", many: "extra bags" },
];

const EXAMPLE_CHIPS: { key: string; label: string; text: string }[] = [
  { key: "quiet", label: "Quiet flight requested", text: "Quiet flight requested — please limit cabin announcements." },
  { key: "champagne", label: "Champagne on arrival", text: "Champagne on arrival, chilled." },
  { key: "wheelchair", label: "Wheelchair assist", text: "One passenger needs wheelchair assist at both private terminals." },
  { key: "kosher", label: "Kosher catering", text: "Kosher meals please — strict." },
  { key: "bedrest", label: "Need bed/lie-flat seat", text: "Lie-flat / bed configuration required for one passenger." },
];

const NOTES_MAX = 800;

type SectionKey = "cabin" | "catering" | "ground" | "extras" | "notes";

export default function AircraftStep() {
  return (
    <StoreHydrationGate>
      <AircraftStepInner />
    </StoreHydrationGate>
  );
}

function AircraftStepInner() {
  const router = useRouter();
  const s = useQuoteStore();
  const [open, setOpen] = useState<Partial<Record<SectionKey, boolean>>>({});
  const [showErrors, setShowErrors] = useState(false);

  // Bounce to mission if upstream not done.
  useEffect(() => {
    if (!isMissionComplete(s)) router.replace("/quote/mission");
  }, [s, router]);

  const longestLeg = Math.max(0, ...s.legs.map((l) => l.distanceNm ?? 0));
  const recommended = recommendCategory(s.pax, longestLeg);

  function categoryFits(cat: AircraftCategorySlug): { ok: boolean; reason?: string } {
    const fleet = FLEET.find((f) => f.slug === cat)!;
    if (fleet.pax < s.pax) return { ok: false, reason: `Too small for ${s.pax} passengers` };
    if (fleet.rangeNm < longestLeg) {
      return { ok: false, reason: `Range short of ${longestLeg.toLocaleString("en-US")} nm` };
    }
    return { ok: true };
  }

  const selectedFits = categoryFits(s.category).ok;
  const complete = isAircraftComplete(s) && selectedFits;
  const error =
    showErrors && !complete ? "Pick an aircraft category that fits your passengers and route." : null;

  const toggle = (k: SectionKey) => () => setOpen((o) => ({ ...o, [k]: !o[k] }));

  function appendNote(text: string) {
    const sep = s.notes ? "\n" : "";
    s.setNotes((s.notes + sep + text).slice(0, NOTES_MAX));
  }

  function onContinue() {
    if (!complete) {
      setShowErrors(true);
      return;
    }
    router.push("/quote/contact");
  }

  // One-line summaries for the collapsed headers — always the current selection.
  const cabinOn = CABIN_TOGGLES.filter((t) => s.cabin[t.key]).map((t) => t.name);
  const cabinSummary = cabinOn.length ? cabinOn.join(" · ") : "None requested";
  const cateringSummary = `Catering: ${CATERING.find((c) => c.id === s.catering)?.name ?? "—"}`;
  const groundSummary = `Ground transport: ${GROUND.find((g) => g.id === s.ground)?.short ?? "—"}`;
  const extrasList = EXTRAS.filter((x) => s[x.k] > 0).map(
    (x) => `${s[x.k]} ${s[x.k] === 1 ? x.one : x.many}`,
  );
  const extrasSummary = extrasList.length ? extrasList.join(" · ") : "None";
  const notesFirstLine = s.notes.trim().split("\n")[0];
  const notesSummary = notesFirstLine
    ? notesFirstLine.length > 72
      ? `${notesFirstLine.slice(0, 72)}…`
      : notesFirstLine
    : "Special requests, mobility needs, time-sensitive details.";

  const tileBase =
    "rounded-[3px] border bg-surface p-3.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clearance";
  const tileBorder = (on: boolean) =>
    on ? "border-clearance shadow-[0_0_0_1px_var(--clearance)]" : "border-line hover:border-line-2";

  return (
    <QuotePanel>
      <PanelHeader step={2} title="The shape of the flight.">
        Pick a category — everything else is optional and dispatch can fill it in. We&rsquo;ve
        pre-recommended the right size for your route and group.
      </PanelHeader>

      <TripSummaryBar />

      {/* Category */}
      <section className="mt-[18px]" aria-labelledby="category-heading">
        <PanelLabel as="h2" id="category-heading">
          Aircraft size
        </PanelLabel>
        <p className="mt-1 text-[13px] text-steel">
          Greyed-out categories don&rsquo;t fit your passenger count or route distance — adjust
          either to unlock.
        </p>
        <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-2.5">
          {FLEET.map((f) => {
            const fit = categoryFits(f.slug);
            const selected = s.category === f.slug;
            const recommend = f.slug === recommended && fit.ok;
            return (
              <button
                key={f.slug}
                type="button"
                disabled={!fit.ok}
                aria-pressed={selected}
                onClick={() => s.setCategory(f.slug)}
                className={[
                  tileBase,
                  "relative min-h-[76px]",
                  !fit.ok ? "cursor-not-allowed border-line opacity-45" : tileBorder(selected),
                  showErrors && selected && !fit.ok ? "!border-danger !opacity-70" : "",
                ].join(" ")}
              >
                {recommend ? (
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">
                    Recommended
                  </span>
                ) : null}
                <span className="block text-[15px] font-semibold leading-[1.3] text-bone">{f.name}</span>
                <span className="mt-0.5 block text-[13px] text-steel">
                  Up to {f.pax} passengers · {f.rangeNm.toLocaleString("en-US")} nm range
                </span>
                {!fit.ok ? (
                  <span className="mt-1 block text-[13px] text-danger">{fit.reason}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      {/* Optional groups */}
      <div className="mt-[18px] flex flex-col gap-2">
        <PanelLabel as="p">
          Optional <span className="font-normal normal-case tracking-normal text-steel">— open only what you care about</span>
        </PanelLabel>

        <CollapsibleSection
          id="cabin"
          title="Cabin preferences"
          summary={cabinSummary}
          open={!!open.cabin}
          onToggle={toggle("cabin")}
        >
          <p className="mb-3 text-[13px] text-steel">
            All standard on most aircraft. We&rsquo;ll match to operators that have what you ask
            for.
          </p>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-2">
            {CABIN_TOGGLES.map((t) => {
              const on = s.cabin[t.key];
              return (
                <button
                  key={t.key}
                  type="button"
                  role="switch"
                  aria-checked={on}
                  onClick={() => s.toggleCabin(t.key)}
                  className={`${tileBase} flex min-h-[52px] items-start gap-3 ${tileBorder(on)}`}
                >
                  <span
                    aria-hidden="true"
                    className={[
                      "switch mt-0.5",
                      on ? "!bg-clearance after:translate-x-4" : "",
                    ].join(" ")}
                  />
                  <span>
                    <span className="block text-[15px] font-semibold text-bone">{t.name}</span>
                    <span className="mt-0.5 block text-[13px] text-steel">{t.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          id="catering"
          title="What’s on board"
          summary={cateringSummary}
          open={!!open.catering}
          onToggle={toggle("catering")}
        >
          <p className="mb-3 text-[13px] text-steel">
            Curated menus from network providers. Custom requests &amp; dietary in notes below.
          </p>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))] gap-2">
            {CATERING.map((c) => {
              const selected = s.catering === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => s.setCatering(c.id)}
                  className={`${tileBase} min-h-[52px] ${tileBorder(selected)}`}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-[15px] font-semibold text-bone">{c.name}</span>
                    <span className="text-[12px] text-gold">{c.price}</span>
                  </span>
                  <span className="mt-1 block text-[13px] text-steel">{c.desc}</span>
                </button>
              );
            })}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          id="ground"
          title="Curb to cabin"
          summary={groundSummary}
          open={!!open.ground}
          onToggle={toggle("ground")}
        >
          <p className="mb-3 text-[13px] text-steel">
            Black car or chauffeur to the private terminal at every leg. Independent of the air
            charter cost.
          </p>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-2">
            {GROUND.map((g) => {
              const selected = s.ground === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => s.setGround(g.id)}
                  className={`${tileBase} min-h-[52px] ${tileBorder(selected)}`}
                >
                  <span className="block text-[15px] font-semibold text-bone">{g.name}</span>
                  <span className="mt-1 block text-[13px] text-steel">{g.desc}</span>
                </button>
              );
            })}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          id="extras"
          title="Anyone or anything else?"
          summary={extrasSummary}
          open={!!open.extras}
          onToggle={toggle("extras")}
        >
          <p className="mb-3 text-[13px] text-steel">
            Pets fly in cabin on most aircraft. Crew adjusts catering &amp; safety briefing for
            kids.
          </p>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-2">
            {EXTRAS.map((x) => {
              const value = s[x.k];
              return (
                <div key={x.k} className="rounded-[3px] border border-line bg-surface p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[15px] font-semibold text-bone">{x.name}</span>
                    <span className="stepper gap-1.5 [&>button]:h-8 [&>button]:w-8 max-md:[&>button]:h-11 max-md:[&>button]:w-11">
                      <button
                        type="button"
                        onClick={() => s.setExtra(x.k, value - 1)}
                        disabled={value <= 0}
                        aria-label={`Fewer ${x.many}`}
                      >
                        −
                      </button>
                      <span className="min-w-[20px] text-center text-[15px] text-bone" aria-live="polite">
                        {value}
                        <span className="sr-only"> {value === 1 ? x.one : x.many}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => s.setExtra(x.k, value + 1)}
                        disabled={value >= x.max}
                        aria-label={`More ${x.many}`}
                      >
                        +
                      </button>
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13px] text-steel">{x.desc}</p>
                </div>
              );
            })}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          id="notes"
          title="Anything else dispatch should know?"
          summary={notesSummary}
          open={!!open.notes}
          onToggle={toggle("notes")}
        >
          <label htmlFor="notes" className="sr-only">
            Notes for dispatch
          </label>
          <textarea
            id="notes"
            value={s.notes}
            onChange={(e) => s.setNotes(e.target.value)}
            rows={4}
            maxLength={NOTES_MAX}
            placeholder="e.g. Wedding party — need full recline seats and extra cabin baggage. One passenger uses a wheelchair, will need ground assist at both terminals."
            className="w-full resize-y rounded-[3px] border border-line bg-surface px-3 py-2.5 text-[15px] leading-[1.55] text-bone outline-none transition-[border-color,box-shadow] placeholder:text-steel-dim focus:border-bone focus:shadow-[0_0_0_1px_var(--bone)]"
          />
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-steel">Add common:</span>
            {EXAMPLE_CHIPS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => appendNote(c.text)}
                className="chip chip-sm max-md:!h-11"
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between gap-4 text-[13px] text-steel">
            <span>Visible to dispatch &amp; operator only</span>
            <span aria-live="polite">
              {s.notes.length} / {NOTES_MAX}
            </span>
          </div>
        </CollapsibleSection>
      </div>

      <IndicativeRange className="mt-[18px]" />

      <StepFooter
        step={2}
        backHref="/quote/mission"
        error={error}
        next={{ label: "Continue to contact details", onClick: onContinue }}
      />
    </QuotePanel>
  );
}
