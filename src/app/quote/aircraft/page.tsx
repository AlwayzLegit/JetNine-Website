"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  isAircraftComplete,
  isMissionComplete,
  useQuoteStore,
} from "@/lib/quote-store";
import { QuoteSidebar } from "@/components/quote/quote-sidebar";
import { SavedIndicator } from "@/components/quote/saved-indicator";
import { StoreHydrationGate } from "@/components/quote/store-hydration";
import { FLEET, type AircraftCategorySlug } from "@/lib/fleet";
import {
  HOURLY_USD,
  type CateringTier,
  type GroundType,
} from "@/lib/quote-pricing";
import { useEffect } from "react";

const CABIN_TOGGLES: {
  key: keyof ReturnType<typeof useQuoteStore.getState>["cabin"];
  name: string;
  desc: string;
}[] = [
  { key: "wifi", name: "Wi-Fi", desc: "Gogo Avance L5 or better, on most cabins" },
  { key: "attendant", name: "Flight attendant", desc: "Standard on heavy & ULR, available on midsize+" },
  { key: "lavatory", name: "Enclosed lavatory", desc: "Standard on midsize+, optional on light" },
  { key: "standup", name: "Stand-up cabin", desc: "Midsize and larger only" },
  { key: "lieflat", name: "Lie-flat seating", desc: "Available on heavy & ULR airframes" },
  { key: "pet", name: "Pet-friendly", desc: "In-cabin, no carrier — confirmed at booking" },
];

const CATERING: { id: CateringTier; name: string; price: string; desc: string }[] = [
  { id: "standard", name: "Standard", price: "Included", desc: "Cold platters, snacks, soft drinks, coffee & tea." },
  { id: "plus", name: "Plus", price: "+$180/leg", desc: "Hot meal options, fresh fruit, premium snacks, full bar." },
  { id: "premium", name: "Premium", price: "+$450/leg", desc: "Chef-prepared menu from a partner restaurant. Choice of 3 entrées." },
  { id: "custom", name: "Custom", price: "Quoted", desc: "Your own menu, your own caterer, your own dietary specs." },
];

const GROUND: { id: GroundType; name: string; desc: string }[] = [
  { id: "none", name: "None — I’ve got it", desc: "No ground transport at any leg." },
  { id: "sedan", name: "Black sedan", desc: "One vehicle per leg, professional chauffeur. ~$180/leg." },
  { id: "suv", name: "SUV / Sprinter", desc: "For groups or extra baggage. From ~$280/leg." },
];

const EXAMPLE_CHIPS: { key: string; label: string; text: string }[] = [
  { key: "quiet", label: "Quiet flight requested", text: "Quiet flight requested — please limit cabin announcements." },
  { key: "champagne", label: "Champagne on arrival", text: "Champagne on arrival, chilled." },
  { key: "wheelchair", label: "Wheelchair assist", text: "One passenger needs wheelchair assist at both FBOs." },
  { key: "kosher", label: "Kosher catering", text: "Kosher meals please — strict." },
  { key: "bedrest", label: "Need bed/lie-flat seat", text: "Lie-flat / bed configuration required for one passenger." },
];

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

  // Bounce to mission if upstream not done.
  useEffect(() => {
    if (!isMissionComplete(s)) router.replace("/quote/mission");
  }, [s, router]);

  const longestLeg = Math.max(...s.legs.map((l) => l.distanceNm ?? 0));
  const canContinue = isAircraftComplete(s);

  function categoryFits(cat: AircraftCategorySlug): { ok: boolean; reason?: string } {
    const fleet = FLEET.find((f) => f.slug === cat)!;
    if (fleet.pax < s.pax) return { ok: false, reason: `Too small for ${s.pax} pax` };
    if (fleet.rangeNm < longestLeg) return { ok: false, reason: `Range short of ${longestLeg} NM` };
    return { ok: true };
  }

  function appendNote(text: string) {
    const sep = s.notes ? "\n" : "";
    s.setNotes((s.notes + sep + text).slice(0, 800));
  }

  return (
    <div className="container-jn py-12 lg:py-16">
      <div className="grid gap-10 lg:grid-cols-[1fr_380px] lg:gap-12">
        <div className="flex min-w-0 flex-col gap-12">
          <header>
            <p className="caption mb-4">— Step 02 · Aircraft &amp; preferences</p>
            <h1 className="display-l max-w-[18ch]">The shape of the flight.</h1>
            <p className="mt-5 max-w-[60ch] text-[17px] leading-[1.55] text-bone-2">
              Pick a category and tell us how you want it set up. Everything is optional except
              category — dispatch can fill in the rest. We&rsquo;ve pre-recommended the right size
              for your route &amp; pax.
            </p>
          </header>

          {/* 01 — Category */}
          <Section n="01" lead="Match the airframe to the mission." sub="Greyed-out categories don't fit your pax count or route distance — adjust either to unlock.">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {FLEET.map((f) => {
                const fit = categoryFits(f.slug);
                const selected = s.category === f.slug;
                const recommend = f.slug === "midsize" && fit.ok;
                return (
                  <button
                    key={f.slug}
                    type="button"
                    disabled={!fit.ok}
                    onClick={() => s.setCategory(f.slug)}
                    className={[
                      "relative flex flex-col gap-4 rounded-[4px] border bg-ink-2 p-6 text-left transition-all duration-200 ease-out-quint",
                      !fit.ok
                        ? "cursor-not-allowed opacity-40"
                        : selected
                          ? "border-clearance shadow-[0_0_0_1px_var(--clearance)]"
                          : "border-ink-3 hover:-translate-y-0.5 hover:border-[rgba(232,226,210,0.3)]",
                    ].join(" ")}
                  >
                    {recommend ? (
                      <span className="absolute right-3 top-3 rounded-[2px] bg-clearance px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink">
                        Recommended
                      </span>
                    ) : null}
                    {selected ? (
                      <span className="absolute left-3 top-3 font-mono text-[14px] text-clearance">✓</span>
                    ) : null}
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
                      — CAT {String(f.index).padStart(2, "0")}
                    </span>
                    <h3 className="font-serif text-[24px] font-normal leading-[1.15] tracking-tight text-bone">
                      {f.name}
                    </h3>
                    <div
                      className={[
                        "inline-flex w-fit rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]",
                        fit.ok
                          ? "border-ink-3 text-bone-2"
                          : "border-[var(--warn)] text-[var(--warn)]",
                      ].join(" ")}
                    >
                      {f.pax} PAX
                    </div>
                    {!fit.ok ? (
                      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--warn)]">
                        ⚠ {fit.reason}
                      </p>
                    ) : null}
                    <dl className="grid grid-cols-3 gap-2 border-t border-ink-3 pt-4">
                      {[
                        ["RANGE", `${f.rangeNm.toLocaleString()} NM`],
                        ["SPEED", `${f.speedKt} KT`],
                        ["HOURLY", `$${(HOURLY_USD[f.slug] / 1000).toFixed(1)}k`],
                      ].map(([lbl, val]) => (
                        <div key={lbl} className="flex flex-col gap-0.5">
                          <dt className="font-mono text-[9px] uppercase tracking-[0.12em] text-steel">
                            {lbl}
                          </dt>
                          <dd className="font-mono text-[11px] tracking-[0.04em] text-bone">
                            {val}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* 02 — Cabin */}
          <Section n="02" lead="Cabin preferences." sub="All standard on most airframes. We'll match to operators that have what you ask for.">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {CABIN_TOGGLES.map((t) => {
                const on = s.cabin[t.key];
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => s.toggleCabin(t.key)}
                    className={[
                      "flex items-start gap-4 rounded-[4px] border bg-ink-2 p-5 text-left transition-colors",
                      on ? "border-clearance" : "border-ink-3 hover:border-bone-2",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "mt-1 flex h-5 w-9 items-center rounded-full p-0.5 transition-colors",
                        on ? "bg-clearance" : "bg-ink-4",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "h-4 w-4 rounded-full bg-bone transition-transform",
                          on ? "translate-x-4" : "translate-x-0",
                        ].join(" ")}
                      />
                    </span>
                    <div>
                      <div className="font-serif text-[17px] text-bone">{t.name}</div>
                      <div className="mt-1 text-[13px] leading-[1.5] text-bone-2">{t.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* 03 — Catering */}
          <Section n="03" lead="What's on board." sub="Curated menus from network providers. Custom requests & dietary in notes below.">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {CATERING.map((c) => {
                const selected = s.catering === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => s.setCatering(c.id)}
                    className={[
                      "flex h-full flex-col gap-3 rounded-[4px] border bg-ink-2 p-5 text-left transition-colors",
                      selected ? "border-clearance" : "border-ink-3 hover:border-bone-2",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-serif text-[18px] text-bone">{c.name}</span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-clearance">
                        {c.price}
                      </span>
                    </div>
                    <p className="text-[13px] leading-[1.55] text-bone-2">{c.desc}</p>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* 04 — Ground */}
          <Section n="04" lead="Curb to cabin." sub="Black car or chauffeur to FBO at every leg. Independent of the air charter cost.">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {GROUND.map((g) => {
                const selected = s.ground === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => s.setGround(g.id)}
                    className={[
                      "flex h-full flex-col gap-2 rounded-[4px] border bg-ink-2 p-5 text-left transition-colors",
                      selected ? "border-clearance" : "border-ink-3 hover:border-bone-2",
                    ].join(" ")}
                  >
                    <span className="font-serif text-[17px] text-bone">{g.name}</span>
                    <p className="text-[13px] leading-[1.55] text-bone-2">{g.desc}</p>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* 05 — Extras */}
          <Section n="05" lead="Anyone or anything else?" sub="Pets fly in cabin on most airframes. Crew adjusts catering & safety briefing for kids.">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {[
                { k: "kids" as const, name: "Children", desc: "Under 12, with car-seat as needed", max: 8 },
                { k: "pets" as const, name: "Pets", desc: "In cabin, no carrier required", max: 4 },
                { k: "bags" as const, name: "Extra bags", desc: "Beyond 1 carry-on + 1 checked / pax", max: 12 },
              ].map(({ k, name, desc, max }) => {
                const value = s[k];
                return (
                  <div key={k} className="rounded-[4px] border border-ink-3 bg-ink-2 p-5">
                    <div className="flex items-center justify-between">
                      <span className="font-serif text-[17px] text-bone">{name}</span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => s.setExtra(k, value - 1)}
                          disabled={value <= 0}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-3 text-bone disabled:opacity-30"
                        >
                          −
                        </button>
                        <span className="w-6 text-center font-serif text-[20px] text-bone">{value}</span>
                        <button
                          type="button"
                          onClick={() => s.setExtra(k, value + 1)}
                          disabled={value >= max}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-3 text-bone disabled:opacity-30"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <p className="mt-3 text-[12px] leading-[1.5] text-bone-2">{desc}</p>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* 06 — Notes */}
          <Section n="06" lead="Anything else dispatch should know?" sub="Special requests, mobility needs, time-sensitive details. Free-form.">
            <div className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
              <label htmlFor="notes" className="font-mono text-[10px] uppercase tracking-[0.12em] text-bone-2">
                Notes for dispatch
              </label>
              <textarea
                id="notes"
                value={s.notes}
                onChange={(e) => s.setNotes(e.target.value)}
                rows={5}
                maxLength={800}
                placeholder="e.g. Wedding party — need full recline seats and extra cabin baggage. One passenger uses a wheelchair, will need ground assist at both FBOs."
                className="mt-3 w-full resize-y bg-transparent text-[14px] leading-[1.6] text-bone outline-none placeholder:text-steel"
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
                  Visible to dispatch &amp; operator only
                </span>
                <span className="font-mono text-[10px] tracking-[0.04em] text-bone-2">
                  {s.notes.length} / 800
                </span>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-bone-2">
                — Add common
              </span>
              {EXAMPLE_CHIPS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => appendNote(c.text)}
                  className="rounded-full border border-ink-3 bg-ink-2 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-bone-2 transition-colors hover:border-clearance hover:text-bone"
                >
                  {c.label}
                </button>
              ))}
            </div>
          </Section>

          {/* Step actions */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-ink-3 pt-8">
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-clearance">
                Step 02 of 04
              </span>
              <SavedIndicator />
            </div>
            <div className="flex items-center gap-6">
              <Link href="/quote/mission" className="btn btn-ghost">
                ← Back
              </Link>
              <button
                type="button"
                disabled={!canContinue}
                onClick={() => router.push("/quote/contact")}
                className="btn btn-primary btn-lg disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue to contact <span className="arrow">→</span>
              </button>
            </div>
          </div>
        </div>

        <QuoteSidebar step={2} />
      </div>
    </div>
  );
}

function Section({
  n,
  lead,
  sub,
  children,
}: {
  n: string;
  lead: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-6 lg:grid-cols-[200px_1fr] lg:gap-10">
      <div>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-clearance">
          — {n}
        </span>
        <h2 className="mt-3 font-serif text-[22px] font-normal leading-[1.2] tracking-tight text-bone">
          {lead}
        </h2>
        <p className="mt-3 text-[13px] leading-[1.55] text-bone-2">{sub}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}
