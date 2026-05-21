"use client";

import { useState, useTransition, type FormEvent } from "react";
import { savePreferences } from "./actions";
import type { MemberPreferences } from "@/db/schema/member-prefs";

type Props = {
  initial: MemberPreferences | null;
};

const CABIN_FIELDS: { key: keyof MemberPreferences; label: string; desc: string }[] = [
  { key: "cabinWifi", label: "Wi-Fi standard", desc: "We only source airframes with installed Wi-Fi." },
  { key: "cabinStandup", label: "Stand-up cabin", desc: "Midsize or larger only — disables light + turboprop options." },
  { key: "cabinLavatoryEnclosed", label: "Enclosed lavatory", desc: "Standard on midsize+, optional on light." },
  { key: "cabinLieflat", label: "Lie-flat seating", desc: "Available on heavy & ultra-long-range. See threshold below." },
  { key: "cabinFlightAttendant", label: "Flight attendant", desc: "Standard on heavy & ULR; flat add-on on midsize." },
  { key: "cabinPetFriendly", label: "Pet-friendly", desc: "In-cabin, no carrier. Crew briefed pre-flight." },
];

const CATERING_OPTIONS = [
  { id: "standard", label: "Standard", desc: "Cold platters, snacks, bar." },
  { id: "plus", label: "Plus", desc: "Hot meals + premium bar." },
  { id: "premium", label: "Premium", desc: "Chef-prepared menu." },
  { id: "custom", label: "Custom", desc: "Bring your own caterer." },
];

const GROUND_OPTIONS = [
  { id: "none", label: "None", desc: "I'll handle ground." },
  { id: "sedan", label: "Black sedan", desc: "Default." },
  { id: "suv_sprinter", label: "SUV / Sprinter", desc: "Groups + extra bags." },
  { id: "custom", label: "Custom", desc: "Named vendor below." },
];

const AIRCRAFT_OPTIONS = [
  { id: "", label: "— No default · let dispatcher pick" },
  { id: "turboprop", label: "Turboprop" },
  { id: "light", label: "Light" },
  { id: "midsize", label: "Midsize" },
  { id: "supermid", label: "Super-mid" },
  { id: "heavy", label: "Heavy" },
  { id: "ulr", label: "Ultra long range" },
];

export function PreferencesForm({ initial }: Props) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await savePreferences(data);
      if (result.ok) {
        setMsg({ tone: "ok", text: "Saved — dispatch will use these on your next quote." });
      } else {
        setMsg({ tone: "error", text: result.error });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-12">
      {/* Aircraft */}
      <Section n="01" title="Aircraft default" sub="Skip if you prefer dispatcher to pick per mission.">
        <div className="field-jn max-w-[480px]">
          <label htmlFor="defaultAircraftCategory">Default category</label>
          <select
            id="defaultAircraftCategory"
            name="defaultAircraftCategory"
            defaultValue={initial?.defaultAircraftCategory ?? ""}
          >
            {AIRCRAFT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </Section>

      {/* Cabin */}
      <Section n="02" title="Cabin defaults" sub="Toggles flow into every new quote — adjust per-trip on the wizard.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {CABIN_FIELDS.map((f) => (
            <Toggle
              key={String(f.key)}
              name={String(f.key)}
              label={f.label}
              desc={f.desc}
              defaultChecked={initial ? (initial[f.key] as boolean) : f.key === "cabinWifi" || f.key === "cabinLavatoryEnclosed"}
            />
          ))}
        </div>
        <div className="mt-6 grid max-w-[480px] gap-2">
          <label
            htmlFor="lieflatMinHours"
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2"
          >
            — Force lie-flat above N hours
          </label>
          <input
            id="lieflatMinHours"
            name="lieflatMinHours"
            type="number"
            min={0}
            max={24}
            defaultValue={initial?.lieflatMinHours ?? 5}
            className="rounded-[2px] border border-ink-3 bg-ink-2 px-3 py-2 font-mono text-[14px] tracking-[0.04em] text-bone"
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
            — Only matters if you fly transoceanic. Set to 0 to disable.
          </span>
        </div>
      </Section>

      {/* Catering */}
      <Section n="03" title="Catering" sub="Quick tier + free-form dietary so the dispatcher doesn't have to ask.">
        <RadioGrid name="cateringTier" options={CATERING_OPTIONS} defaultValue={initial?.cateringTier ?? "standard"} />
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField id="dietary" name="dietary" label="Dietary" placeholder="e.g. strict kosher; tree-nut allergy" defaultValue={initial?.dietary ?? ""} />
          <TextField id="barPreferences" name="barPreferences" label="Bar" placeholder="e.g. Pappy 23, sparkling water, no beer" defaultValue={initial?.barPreferences ?? ""} />
        </div>
        <TextareaField
          id="standingCateringNotes"
          name="standingCateringNotes"
          label="Standing notes"
          placeholder="Standing requests — coffee setup, snacks for kids, specific brands."
          defaultValue={initial?.standingCateringNotes ?? ""}
        />
      </Section>

      {/* Ground */}
      <Section n="04" title="Ground" sub="Curb-to-FBO defaults. We book and pass through at cost.">
        <RadioGrid name="groundType" options={GROUND_OPTIONS} defaultValue={initial?.groundType ?? "sedan"} />
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField id="groundVendor" name="groundVendor" label="Preferred vendor" placeholder="e.g. Empire CLS, BluStar" defaultValue={initial?.groundVendor ?? ""} />
          <NumberField id="arrivalWindowMinutes" name="arrivalWindowMinutes" label="Arrival window (min)" min={5} max={60} defaultValue={initial?.arrivalWindowMinutes ?? 15} />
        </div>
      </Section>

      {/* Comms */}
      <Section n="05" title="Communications" sub="How and when dispatch can reach you. Quiet hours respected for non-urgent.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {[
            { key: "commsVoice", label: "Voice — initial quote", desc: "Phone call when a quote comes back." },
            { key: "commsEmail", label: "Email — quote sheet", desc: "PDF + itinerary link." },
            { key: "commsSmsUpdates", label: "SMS — trip updates", desc: "En-route status, weather, crew." },
            { key: "commsSmsEmptyLeg", label: "SMS — empty-leg matches", desc: "Only when a match meets your threshold." },
          ].map((f) => (
            <Toggle
              key={f.key}
              name={f.key}
              label={f.label}
              desc={f.desc}
              defaultChecked={initial ? (initial[f.key as keyof MemberPreferences] as boolean) : f.key === "commsVoice" || f.key === "commsEmail"}
            />
          ))}
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <TimeField id="quietHoursStart" name="quietHoursStart" label="Quiet from" defaultValue={initial?.quietHoursStart ?? ""} />
          <TimeField id="quietHoursEnd" name="quietHoursEnd" label="Quiet to" defaultValue={initial?.quietHoursEnd ?? ""} />
          <TextField id="quietHoursTz" name="quietHoursTz" label="Timezone" placeholder="America/Los_Angeles" defaultValue={initial?.quietHoursTz ?? ""} />
        </div>
        <div className="mt-6 max-w-[320px]">
          <NumberField
            id="emptyLegAlertThresholdPct"
            name="emptyLegAlertThresholdPct"
            label="Empty-leg alert threshold (%)"
            min={0}
            max={80}
            defaultValue={initial?.emptyLegAlertThresholdPct ?? 40}
          />
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
            — Alert me only when discount ≥ this percent off full charter.
          </p>
        </div>
      </Section>

      {/* Privacy */}
      <Section n="06" title="Privacy" sub="What the operator and the public can see.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Toggle
            name="anonymizeManifest"
            label="Anonymize on manifest"
            desc="Operator sees your initials until check-in."
            defaultChecked={initial?.anonymizeManifest ?? false}
          />
          <Toggle
            name="blockFlightTracking"
            label="Block public flight tracking"
            desc="Suppress tail on FlightAware / ADS-B Exchange (operator-side flag)."
            defaultChecked={initial?.blockFlightTracking ?? false}
          />
        </div>
      </Section>

      {/* Submit */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-ink-3 pt-8">
        <p className="max-w-[40ch] font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
          — Saved to your member profile · used by every new quote unless you override on the wizard.
        </p>
        <div className="flex items-center gap-6">
          {msg ? (
            <span
              className={[
                "font-mono text-[11px] uppercase tracking-[0.12em]",
                msg.tone === "error" ? "text-[var(--error)]" : "text-[var(--success)]",
              ].join(" ")}
            >
              {msg.text}
            </span>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="btn btn-primary disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save preferences"} <span className="arrow">→</span>
          </button>
        </div>
      </div>
    </form>
  );
}

function Section({
  n,
  title,
  sub,
  children,
}: {
  n: string;
  title: string;
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
          {title}
        </h2>
        <p className="mt-3 text-[13px] leading-[1.55] text-bone-2">{sub}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}

function Toggle({
  name,
  label,
  desc,
  defaultChecked,
}: {
  name: string;
  label: string;
  desc: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex h-full cursor-pointer items-start gap-4 rounded-[4px] border border-ink-3 bg-ink-2 p-5">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-1 h-4 w-4 accent-clearance" />
      <div>
        <div className="font-serif text-[16px] text-bone">{label}</div>
        <div className="mt-1 text-[12px] leading-[1.5] text-bone-2">{desc}</div>
      </div>
    </label>
  );
}

function RadioGrid({
  name,
  options,
  defaultValue,
}: {
  name: string;
  options: { id: string; label: string; desc: string }[];
  defaultValue: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
      {options.map((o) => (
        <label
          key={o.id}
          className="flex h-full cursor-pointer flex-col gap-2 rounded-[4px] border border-ink-3 bg-ink-2 p-5 has-[input:checked]:border-clearance"
        >
          <input
            type="radio"
            name={name}
            value={o.id}
            defaultChecked={defaultValue === o.id}
            className="sr-only"
          />
          <span className="font-serif text-[17px] text-bone">{o.label}</span>
          <span className="text-[12px] leading-[1.5] text-bone-2">{o.desc}</span>
        </label>
      ))}
    </div>
  );
}

function TextField({
  id,
  name,
  label,
  placeholder,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <div className="field-jn">
      <label htmlFor={id}>{label}</label>
      <input id={id} name={name} type="text" placeholder={placeholder} defaultValue={defaultValue ?? ""} />
    </div>
  );
}

function TextareaField({
  id,
  name,
  label,
  placeholder,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <div className="field-jn mt-4">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} name={name} placeholder={placeholder} defaultValue={defaultValue ?? ""} rows={3} />
    </div>
  );
}

function NumberField({
  id,
  name,
  label,
  min,
  max,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  min: number;
  max: number;
  defaultValue: number;
}) {
  return (
    <div className="field-jn">
      <label htmlFor={id}>{label}</label>
      <input id={id} name={name} type="number" min={min} max={max} defaultValue={defaultValue} />
    </div>
  );
}

function TimeField({
  id,
  name,
  label,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue?: string;
}) {
  return (
    <div className="field-jn">
      <label htmlFor={id}>{label}</label>
      <input id={id} name={name} type="time" defaultValue={defaultValue ?? ""} />
    </div>
  );
}
