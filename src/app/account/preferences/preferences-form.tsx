"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { savePreferences } from "./actions";
import type { MemberPreferences } from "@/db/schema/member-prefs";
import { PreferencesToggle } from "@/components/account/preferences-toggle";
import { PreferencesChips } from "@/components/account/preferences-chips";
import { PreferencesFeedback, type Feedback } from "@/components/account/preferences-feedback";

type Props = {
  initial: MemberPreferences | null;
};

const CABIN_FIELDS: { key: keyof MemberPreferences; label: string; desc: string }[] = [
  { key: "cabinWifi", label: "Wi-Fi on board", desc: "We only source aircraft with Wi-Fi installed." },
  { key: "cabinStandup", label: "Stand-up cabin", desc: "Midsize or larger only — rules out light jets and turboprops." },
  { key: "cabinLavatoryEnclosed", label: "Enclosed lavatory", desc: "Standard on midsize and up, optional on light jets." },
  { key: "cabinLieflat", label: "Lie-flat seats", desc: "Heavy and ultra long range aircraft. See the threshold below." },
  { key: "cabinFlightAttendant", label: "Flight attendant", desc: "Standard on heavy and ultra long range; a flat add-on on midsize." },
  { key: "cabinPetFriendly", label: "Pet-friendly", desc: "In the cabin, no carrier. Crew briefed before the flight." },
];

const CATERING_OPTIONS = [
  { id: "standard", label: "Standard", desc: "Cold platters, snacks and a bar." },
  { id: "plus", label: "Plus", desc: "Hot meals and a premium bar." },
  { id: "premium", label: "Premium", desc: "A chef-prepared menu." },
  { id: "custom", label: "Custom", desc: "Bring your own caterer." },
];

const GROUND_OPTIONS = [
  { id: "none", label: "None", desc: "You'll handle ground transport." },
  { id: "sedan", label: "Black sedan", desc: "The default." },
  { id: "suv_sprinter", label: "SUV or Sprinter", desc: "For groups and extra bags." },
  { id: "custom", label: "Custom", desc: "Name the vendor below." },
];

const AIRCRAFT_OPTIONS = [
  { id: "", label: "No default — let dispatch pick" },
  { id: "turboprop", label: "Turboprop" },
  { id: "light", label: "Light jet" },
  { id: "midsize", label: "Midsize jet" },
  { id: "supermid", label: "Super-midsize jet" },
  { id: "heavy", label: "Heavy jet" },
  { id: "ulr", label: "Ultra long range jet" },
];

const COMMS_FIELDS: { key: keyof MemberPreferences; label: string; desc: string }[] = [
  { key: "commsVoice", label: "Call me when a quote comes back", desc: "A phone call with the first options." },
  { key: "commsEmail", label: "Email me the quote sheet", desc: "PDF and itinerary link." },
  { key: "commsSmsUpdates", label: "Text me trip updates", desc: "Status on the day, weather, crew." },
  { key: "commsSmsEmptyLeg", label: "Text me empty-leg matches", desc: "Only when a match meets your threshold." },
];

type SectionKey = "cabin" | "catering" | "ground" | "comms" | "privacy";

/**
 * Cabin, catering, ground, how we reach you and privacy — the same
 * fields and the same `savePreferences` action as before, laid out as
 * cards. Every card has its own Save button; because the action upserts
 * the whole profile from one FormData, the cards share a single form and
 * any Save submits all of it, so nothing is reset by a partial save.
 */
export function PreferencesForm({ initial }: Props) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ section: SectionKey; feedback: Feedback } | null>(null);
  const sectionRef = useRef<SectionKey>("cabin");

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const data = new FormData(e.currentTarget);
    const section = sectionRef.current;
    startTransition(async () => {
      const result = await savePreferences(data);
      if (result.ok) {
        setMsg({ section, feedback: { tone: "ok", text: "Saved." } });
      } else {
        setMsg({ section, feedback: { tone: "error", text: result.error } });
      }
    });
  }

  function footer(section: SectionKey) {
    const active = pending && sectionRef.current === section;
    return (
      <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-line pt-4">
        <button
          type="submit"
          disabled={pending}
          onClick={() => {
            sectionRef.current = section;
          }}
          className="btn btn-primary btn-sm disabled:cursor-wait"
        >
          {active ? "Saving…" : "Save"} <span className="arrow">→</span>
        </button>
        <PreferencesFeedback msg={msg?.section === section ? msg.feedback : null} />
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] items-start gap-4">
      {/* Cabin */}
      <section className="border border-line bg-surface px-5 py-[18px] md:px-6 md:py-5">
        <h2 className="font-serif text-[20px] font-normal leading-[1.2] text-bone">Cabin</h2>
        <p className="mt-1 text-[14px] leading-[1.5] text-steel">
          What every new quote starts from. Change it on the quote when a trip needs something different.
        </p>
        <div className="field-jn mt-6 max-w-[420px]">
          <label htmlFor="defaultAircraftCategory">Default aircraft</label>
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
        <div className="mt-4 flex flex-wrap gap-2">
          {CABIN_FIELDS.map((f) => (
            <PreferencesToggle
              key={String(f.key)}
              name={String(f.key)}
              label={f.label}
              desc={f.desc}
              defaultChecked={
                initial ? (initial[f.key] as boolean) : f.key === "cabinWifi" || f.key === "cabinLavatoryEnclosed"
              }
            />
          ))}
        </div>
        <div className="field-jn mt-5 max-w-[320px]">
          <label htmlFor="lieflatMinHours">Lie-flat seats on any leg longer than (hours)</label>
          <input
            id="lieflatMinHours"
            name="lieflatMinHours"
            type="number"
            min={0}
            max={24}
            defaultValue={initial?.lieflatMinHours ?? 5}
          />
        </div>
        <p className="mt-2 text-[14px] text-steel">Only matters on long overwater legs. Set it to 0 to switch it off.</p>
        {footer("cabin")}
      </section>

      {/* Catering */}
      <section className="border border-line bg-surface px-5 py-[18px] md:px-6 md:py-5">
        <h2 className="font-serif text-[20px] font-normal leading-[1.2] text-bone">Catering</h2>
        <p className="mt-1 text-[14px] leading-[1.5] text-steel">
          A tier and a few notes, so dispatch doesn&rsquo;t have to ask.
        </p>
        <div className="mt-6 flex flex-col gap-2.5">
          <PreferencesChips
            name="cateringTier"
            label="Catering tier"
            options={CATERING_OPTIONS}
            defaultValue={initial?.cateringTier ?? "standard"}
          />
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            <TextField
              id="dietary"
              name="dietary"
              label="Dietary"
              placeholder="e.g. strict kosher; tree-nut allergy"
              defaultValue={initial?.dietary ?? ""}
            />
            <TextField
              id="barPreferences"
              name="barPreferences"
              label="Bar"
              placeholder="e.g. Pappy 23, sparkling water, no beer"
              defaultValue={initial?.barPreferences ?? ""}
            />
          </div>
          <TextareaField
            id="standingCateringNotes"
            name="standingCateringNotes"
            label="Standing notes"
            placeholder="Standing requests — coffee set-up, snacks for the kids, specific brands."
            defaultValue={initial?.standingCateringNotes ?? ""}
          />
        </div>
        {footer("catering")}
      </section>

      {/* Ground */}
      <section className="border border-line bg-surface px-5 py-[18px] md:px-6 md:py-5">
        <h2 className="font-serif text-[20px] font-normal leading-[1.2] text-bone">Ground</h2>
        <p className="mt-1 text-[14px] leading-[1.5] text-steel">
          Curb to cabin. We book it and pass it through at cost.
        </p>
        <div className="mt-6 flex flex-col gap-2.5">
          <PreferencesChips
            name="groundType"
            label="Ground transport"
            options={GROUND_OPTIONS}
            defaultValue={initial?.groundType ?? "sedan"}
          />
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            <TextField
              id="groundVendor"
              name="groundVendor"
              label="Preferred vendor"
              placeholder="e.g. Empire CLS, BluStar"
              defaultValue={initial?.groundVendor ?? ""}
            />
            <NumberField
              id="arrivalWindowMinutes"
              name="arrivalWindowMinutes"
              label="Arrive before departure (minutes)"
              min={5}
              max={60}
              defaultValue={initial?.arrivalWindowMinutes ?? 15}
            />
          </div>
        </div>
        {footer("ground")}
      </section>

      {/* How we reach you */}
      <section className="border border-line bg-surface px-5 py-[18px] md:px-6 md:py-5">
        <h2 className="font-serif text-[20px] font-normal leading-[1.2] text-bone">How we reach you</h2>
        <p className="mt-1 text-[14px] leading-[1.5] text-steel">
          Quiet hours are respected for anything that isn&rsquo;t urgent.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {COMMS_FIELDS.map((f) => (
            <PreferencesToggle
              key={String(f.key)}
              name={String(f.key)}
              label={f.label}
              desc={f.desc}
              defaultChecked={initial ? (initial[f.key] as boolean) : f.key === "commsVoice" || f.key === "commsEmail"}
            />
          ))}
        </div>
        <div className="mt-5 grid grid-cols-1 gap-2.5 md:grid-cols-3">
          <TimeField id="quietHoursStart" name="quietHoursStart" label="Quiet from" defaultValue={initial?.quietHoursStart ?? ""} />
          <TimeField id="quietHoursEnd" name="quietHoursEnd" label="Quiet until" defaultValue={initial?.quietHoursEnd ?? ""} />
          <TextField
            id="quietHoursTz"
            name="quietHoursTz"
            label="Time zone"
            placeholder="America/Los_Angeles"
            defaultValue={initial?.quietHoursTz ?? ""}
          />
        </div>
        <div className="mt-2.5 max-w-[320px]">
          <NumberField
            id="emptyLegAlertThresholdPct"
            name="emptyLegAlertThresholdPct"
            label="Empty-leg alerts only at this discount or more (%)"
            min={0}
            max={80}
            defaultValue={initial?.emptyLegAlertThresholdPct ?? 40}
          />
        </div>
        {footer("comms")}
      </section>

      {/* Privacy */}
      <section className="border border-line bg-surface px-5 py-[18px] md:px-6 md:py-5">
        <h2 className="font-serif text-[20px] font-normal leading-[1.2] text-bone">Privacy</h2>
        <p className="mt-1 text-[14px] leading-[1.5] text-steel">What the operator and the public can see.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <PreferencesToggle
            name="anonymizeManifest"
            label="Initials only on the passenger list"
            desc="The operator sees your initials until check-in."
            defaultChecked={initial?.anonymizeManifest ?? false}
          />
          <PreferencesToggle
            name="blockFlightTracking"
            label="Block public flight tracking"
            desc="Asks the operator to hide the aircraft from public tracking sites."
            defaultChecked={initial?.blockFlightTracking ?? false}
          />
        </div>
        {footer("privacy")}
      </section>
    </form>
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
    <div className="field-jn">
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
