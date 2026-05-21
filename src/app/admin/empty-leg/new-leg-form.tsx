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
          text: `CLEARED — ${result.code} published` ,
        });
        form.reset();
        setFull(38000);
        setListed(15200);
      } else {
        setMsg({ tone: "error", text: `BLOCKED — ${result.error.toUpperCase()}` });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8">
      {/* Aircraft */}
      <Section n="01" title="Aircraft">
        <div className="field-jn">
          <label htmlFor="aircraftTail">Tail (must already exist in /admin/aircraft)</label>
          <select id="aircraftTail" name="aircraftTail" required defaultValue="">
            <option value="" disabled>
              — Pick a tail —
            </option>
            {tails.map((t) => (
              <option key={t.tail} value={t.tail}>
                {t.tail} · {t.makeModel} · {t.operator}
              </option>
            ))}
          </select>
        </div>
      </Section>

      {/* Route */}
      <Section n="02" title="Route">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <TextField name="fromIcao" label="From ICAO" placeholder="KVNY" required />
          <TextField name="fromIata" label="From IATA" placeholder="VNY" />
          <TextField name="fromCity" label="From city" placeholder="Los Angeles" />
          <TextField name="toIcao" label="To ICAO" placeholder="KTEB" required />
          <TextField name="toIata" label="To IATA" placeholder="TEB" />
          <TextField name="toCity" label="To city" placeholder="New York" />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <DateTimeField name="wheelsUpAt" label="Wheels-up (local of origin)" required />
          <NumberField name="flightMinutes" label="Flight time (min)" placeholder="290" />
          <NumberField name="distanceNm" label="Distance (NM)" placeholder="2151" />
        </div>
      </Section>

      {/* Pricing */}
      <Section n="03" title="Pricing">
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
            label="Full charter ref ($)"
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
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3 items-end">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
              — Discount auto-computed
            </div>
            <div
              className={[
                "mt-2 font-serif text-[32px] font-light leading-none",
                discount < 30 ? "text-[var(--warn)]" : "text-clearance",
              ].join(" ")}
              style={{ letterSpacing: "-0.02em" }}
            >
              {discount}% off
            </div>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
              — Floor 30%, publish blocked if &lt; 5%.
            </p>
          </div>
          <NumberField
            name="minDiscountPct"
            label="Min discount (auto-decay floor)"
            placeholder="30"
            min={0}
            max={80}
            defaultValue={30}
          />
          <CheckboxField
            name="autoPriceDecay"
            label="Auto-decay 5%/day to floor"
          />
        </div>
      </Section>

      {/* Copy */}
      <Section n="04" title="Copy">
        <TextField
          name="headline"
          label="Headline (shown on board card)"
          placeholder="Tonight, Van Nuys to Teterboro — 60% off"
        />
        <TextareaField
          name="bodyCopy"
          label="Body copy"
          placeholder="Citation Latitude positioning empty back to TEB tonight. Eight seats. Pets welcome."
        />
      </Section>

      {/* Visibility */}
      <Section n="05" title="Visibility">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <CheckboxField name="visPublic" label="Public board" defaultChecked />
          <CheckboxField name="visMemberMatch" label="Member watchlist match" defaultChecked />
          <CheckboxField name="visWeekly" label="Weekly empty-leg digest" />
          <CheckboxField name="petFriendly" label="Pets welcome on this leg" defaultChecked />
        </div>
      </Section>

      {/* Status */}
      <Section n="06" title="Status">
        <div className="field-jn max-w-[280px]">
          <label htmlFor="status">Publish state</label>
          <select id="status" name="status" defaultValue="draft">
            <option value="draft">Draft — not visible</option>
            <option value="scheduled">Scheduled — pre-board-go-live</option>
            <option value="live">Live — public board now</option>
          </select>
        </div>
      </Section>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-ink-3 pt-8">
        {msg ? (
          <span
            className={[
              "font-mono text-[11px] uppercase tracking-[0.12em]",
              msg.tone === "error" ? "text-[var(--error)]" : "text-[var(--success)]",
            ].join(" ")}
          >
            {msg.text}
          </span>
        ) : (
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
            — Code (EL-YYYY-NNNN) is auto-generated by the DB trigger.
          </p>
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
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-[180px_1fr] lg:gap-10">
      <div>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-clearance">
          — {n}
        </span>
        <h2 className="mt-3 font-serif text-[20px] font-normal leading-[1.2] tracking-tight text-bone">
          {title}
        </h2>
      </div>
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
    <label className="flex h-full cursor-pointer items-center gap-3 rounded-[4px] border border-ink-3 bg-ink-2 px-5 py-4">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 accent-clearance"
      />
      <span className="text-[14px] text-bone">{label}</span>
    </label>
  );
}
