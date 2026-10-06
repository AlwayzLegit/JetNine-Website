"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createEmptyLeg } from "./actions";

type Tail = { tail: string; makeModel: string; operator: string };

export function NewEmptyLegForm({ tails }: { tails: Tail[] }) {
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [full, setFull] = useState<number>(38000);
  const [listed, setListed] = useState<number>(15200);

  const discount = full > 0 ? Math.max(0, Math.round(((full - listed) / full) * 100)) : 0;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const form = e.currentTarget;
    setMsg(null);
    startTransition(async () => {
      const result = await createEmptyLeg(data);
      if (result.ok) {
        setMsg({
          tone: "ok",
          text: `Published — ${result.code} is on the board.`,
        });
        form.reset();
        setFull(38000);
        setListed(15200);
      } else {
        setMsg({ tone: "error", text: result.error });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8">
      {/* Aircraft */}
      <Section title="Aircraft">
        <div className="field-jn">
          <label htmlFor="aircraftTail">Aircraft</label>
          <select id="aircraftTail" name="aircraftTail" required defaultValue="">
            <option value="" disabled>
              Pick an aircraft
            </option>
            {tails.map((t) => (
              <option key={t.tail} value={t.tail}>
                {t.tail} · {t.makeModel} · {t.operator}
              </option>
            ))}
          </select>
        </div>
        <p className="mt-2 text-[13px] text-steel">Only aircraft already on file under Aircraft are listed.</p>
      </Section>

      {/* Route */}
      <Section title="Route">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <TextField name="fromIcao" label="From (ICAO)" placeholder="KVNY" required />
          <TextField name="fromIata" label="From (IATA)" placeholder="VNY" />
          <TextField name="fromCity" label="From city" placeholder="Los Angeles" />
          <TextField name="toIcao" label="To (ICAO)" placeholder="KTEB" required />
          <TextField name="toIata" label="To (IATA)" placeholder="TEB" />
          <TextField name="toCity" label="To city" placeholder="New York" />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <DateTimeField name="wheelsUpAt" label="Departure (local time)" required />
          <NumberField name="flightMinutes" label="Flight time (minutes)" placeholder="290" />
          <NumberField name="distanceNm" label="Distance (nautical miles)" placeholder="2151" />
        </div>
      </Section>

      {/* Pricing */}
      <Section title="Pricing">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <NumberField
            name="seats"
            label="Seats available"
            placeholder="8"
            min={1}
            max={19}
            required
          />
          <NumberField
            name="fullCharterRefUsd"
            label="Full charter price ($)"
            value={full}
            onValueChange={(n) => setFull(n)}
            min={1000}
            required
          />
          <NumberField
            name="listedPriceUsd"
            label="Listed price ($)"
            value={listed}
            onValueChange={(n) => setListed(n)}
            min={500}
            required
          />
        </div>
        <div className="mt-3 grid grid-cols-1 items-end gap-3 md:grid-cols-3">
          <div>
            <div className="text-[13px] text-bone-2">Discount (worked out for you)</div>
            <div
              className={[
                "mt-2 font-serif text-[32px] font-light leading-none",
                discount < 30 ? "text-gold" : "text-success",
              ].join(" ")}
              style={{ letterSpacing: "-0.02em" }}
            >
              {discount}% off
            </div>
            <p className="mt-2 text-[13px] text-steel">Floor is 30%; publishing is blocked under 5%.</p>
          </div>
          <NumberField
            name="minDiscountPct"
            label="Minimum discount (floor)"
            placeholder="30"
            min={0}
            max={80}
            defaultValue={30}
          />
          <CheckboxField
            name="autoPriceDecay"
            label="Lower the price 5% a day down to the floor"
          />
        </div>
      </Section>

      {/* Copy */}
      <Section title="Copy">
        <TextField
          name="headline"
          label="Headline"
          placeholder="Tonight, Van Nuys to Teterboro — 60% off"
        />
        <TextareaField
          name="bodyCopy"
          label="Body copy"
          placeholder="Citation Latitude positioning empty back to TEB tonight. Eight seats. Pets welcome."
        />
      </Section>

      {/* Visibility */}
      <Section title="Visibility">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <CheckboxField name="visPublic" label="Public board" defaultChecked />
          <CheckboxField name="visMemberMatch" label="Member watchlist match" defaultChecked />
          <CheckboxField name="visWeekly" label="Weekly empty-leg digest" />
          <CheckboxField name="petFriendly" label="Pets welcome on this leg" defaultChecked />
        </div>
      </Section>

      {/* Status */}
      <Section title="Status">
        <div className="field-jn max-w-[320px]">
          <label htmlFor="status">Publish state</label>
          <select id="status" name="status" defaultValue="draft">
            <option value="draft">Draft — not visible</option>
            <option value="scheduled">Scheduled — goes live later</option>
            <option value="live">Live — on the public board now</option>
          </select>
        </div>
      </Section>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
        {msg ? (
          <span className={`text-[14px] ${msg.tone === "error" ? "text-danger" : "text-success"}`}>
            {msg.text}
          </span>
        ) : (
          <p className="text-[13px] text-steel">The reference code (EL-YYYY-NNNN) is generated automatically.</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Publishing…" : "Publish leg"} <span className="arrow">→</span>
        </button>
      </div>
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3 lg:grid-cols-[160px_1fr] lg:gap-8">
      <h3 className="text-[12px] font-bold uppercase tracking-[0.2em] text-gold lg:pt-1">{title}</h3>
      <div>{children}</div>
    </section>
  );
}

function TextField({
  name,
  label,
  placeholder,
  required,
}: {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="field-jn">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} type="text" placeholder={placeholder} required={required} />
    </div>
  );
}

function TextareaField({
  name,
  label,
  placeholder,
}: {
  name: string;
  label: string;
  placeholder?: string;
}) {
  return (
    <div className="field-jn mt-3">
      <label htmlFor={name}>{label}</label>
      <textarea id={name} name={name} placeholder={placeholder} rows={3} />
    </div>
  );
}

function NumberField({
  name,
  label,
  placeholder,
  min,
  max,
  required,
  defaultValue,
  value,
  onValueChange,
}: {
  name: string;
  label: string;
  placeholder?: string;
  min?: number;
  max?: number;
  required?: boolean;
  defaultValue?: number;
  value?: number;
  onValueChange?: (n: number) => void;
}) {
  return (
    <div className="field-jn">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type="number"
        placeholder={placeholder}
        min={min}
        max={max}
        required={required}
        defaultValue={value === undefined ? defaultValue : undefined}
        value={value}
        onChange={onValueChange ? (e) => onValueChange(Number(e.target.value)) : undefined}
      />
    </div>
  );
}

function DateTimeField({
  name,
  label,
  required,
}: {
  name: string;
  label: string;
  required?: boolean;
}) {
  return (
    <div className="field-jn">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} type="datetime-local" required={required} />
    </div>
  );
}

function CheckboxField({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex h-full cursor-pointer items-center gap-3 rounded-control border border-line bg-surface-2 px-4 py-3">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 accent-clearance"
      />
      <span className="text-[15px] text-bone">{label}</span>
    </label>
  );
}
