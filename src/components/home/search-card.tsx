"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { useQuoteStore, type TripType } from "@/lib/quote-store";

type FieldKey = "from" | "to" | "depart" | "return";
type FieldErrors = Partial<Record<FieldKey, true>>;

const TRIP_TYPES: { id: TripType; label: string }[] = [
  { id: "oneway", label: "One way" },
  { id: "roundtrip", label: "Round trip" },
  { id: "multileg", label: "Multi-city" },
];

const FIELD_WORDS: Record<FieldKey, string> = {
  from: "where you're flying from",
  to: "where you're flying to",
  depart: "a departure date",
  return: "a return date",
};

const PAX_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16];

const ICONS = {
  pin: "M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11zM14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0z",
  calendar: "M3 6h18v15H3zM3 10h18M8 3v4M16 3v4",
  person: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
};

const inputClass =
  "w-full min-w-0 border-0 bg-transparent text-[15px] text-bone outline-none placeholder:text-steel-dim";

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-[18px] w-[18px] flex-none">
      <path d={d} />
    </svg>
  );
}

/**
 * One cell of the Light - Home trip bar: uppercase tracked label over an
 * icon + control row, divided from its neighbour by a 1px line.
 */
function Field({
  label,
  icon,
  error,
  trailing = "›",
  children,
}: {
  label: string;
  icon: string;
  error?: boolean;
  trailing?: string;
  children: ReactNode;
}) {
  return (
    <label
      className={[
        "flex min-w-0 flex-[999_1_140px] flex-col gap-[6px] border-r border-line px-[14px] py-[10px] max-sm:border-b max-sm:border-r-0",
        error ? "bg-[rgba(156,33,33,0.05)] shadow-[inset_0_-2px_0_var(--danger)]" : "",
      ].join(" ")}
    >
      <span className={`text-[12px] font-bold uppercase tracking-[0.14em] ${error ? "text-danger" : "text-steel"}`}>{label}</span>
      <span className="flex items-center gap-2">
        <Icon d={icon} />
        {children}
        <span aria-hidden="true" className={trailing === "›" ? "text-steel" : "text-[12px] text-bone"}>
          {trailing}
        </span>
      </span>
    </label>
  );
}

/**
 * Trip bar under the Home hero. State: `trip` (one way · round trip ·
 * multi-city) and `pax`. On submit it seeds the quote store and hands off
 * to /quote/mission, so the wizard's mission step opens pre-filled — the
 * design's "Request a quote" leads into the real four-step flow.
 */
export function SearchCard() {
  const router = useRouter();
  const [trip, setTrip] = useState<TripType>("oneway");
  const [pax, setPax] = useState(2);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [msg, setMsg] = useState<{ tone: "info" | "error" | "success"; text: string } | null>(null);

  const roundTrip = trip === "roundtrip";

  function changeTrip(next: TripType) {
    setTrip(next);
    setErrors({});
    setMsg(next === "multileg" ? { tone: "info", text: "Multi-city: add up to five legs on the next step." } : null);
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const required: FieldKey[] = ["from", "to", "depart"];
    if (roundTrip) required.push("return");

    const missing: FieldErrors = {};
    for (const key of required) {
      const v = (data.get(key) as string | null)?.trim();
      if (!v) missing[key] = true;
    }

    if (Object.keys(missing).length) {
      setErrors(missing);
      const words = (Object.keys(missing) as FieldKey[]).map((k) => FIELD_WORDS[k]);
      setMsg({ tone: "error", text: `Please add ${words.join(", ")}.` });
      return;
    }

    setErrors({});

    // Seed the quote store, then hand off to the wizard. The store is a
    // sessionStorage-backed client singleton, so these values survive the
    // client-side navigation and the wizard's rehydrate. From/To are seeded
    // as raw codes the user confirms in the mission step's airport picker
    // (which resolves city/name/distance needed for pricing).
    const store = useQuoteStore.getState();
    store.setTripType(trip);
    store.setPax(pax);

    const legs = useQuoteStore.getState().legs;
    const from = (data.get("from") as string).trim().toUpperCase();
    const to = (data.get("to") as string).trim().toUpperCase();
    const depart = data.get("depart") as string;
    if (legs[0]) {
      store.updateLeg(legs[0].id, { fromIata: from, toIata: to, date: depart });
    }
    if (roundTrip && legs[1]) {
      store.updateLeg(legs[1].id, { date: (data.get("return") as string) || undefined });
    }

    setMsg({ tone: "success", text: "Opening your quote…" });
    router.push("/quote/mission");
  }

  return (
    <form noValidate onSubmit={onSubmit} className="border border-line bg-white px-4 pb-[10px] shadow-[0_18px_50px_rgba(18,35,46,0.14)]">
      <div role="tablist" aria-label="Trip type" className="flex flex-wrap gap-[26px] border-b border-line px-1">
        {TRIP_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={trip === t.id}
            onClick={() => changeTrip(t.id)}
            className={`h-11 bg-transparent p-0 text-[14px] text-bone ${trip === t.id ? "font-bold shadow-[inset_0_-2px_0_var(--gold)]" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap border border-line">
        <Field label="From" icon={ICONS.pin} error={errors.from}>
          <input name="from" type="text" placeholder="City or airport" autoComplete="off" aria-invalid={errors.from ? true : undefined} className={inputClass} />
        </Field>
        <Field label="To" icon={ICONS.pin} error={errors.to}>
          <input name="to" type="text" placeholder="City or airport" autoComplete="off" aria-invalid={errors.to ? true : undefined} className={inputClass} />
        </Field>
        <Field label={roundTrip ? "Departure · Return" : "Departure"} icon={ICONS.calendar} error={errors.depart || errors.return}>
          <input name="depart" type="date" aria-label="Departure date" aria-invalid={errors.depart ? true : undefined} className={inputClass} />
          {roundTrip ? (
            <input name="return" type="date" aria-label="Return date" aria-invalid={errors.return ? true : undefined} className={`${inputClass} border-l border-line pl-2`} />
          ) : null}
        </Field>
        <Field label="Passengers" icon={ICONS.person} trailing="⌄">
          <select
            name="pax"
            value={pax}
            onChange={(e) => setPax(Number(e.target.value))}
            className={`${inputClass} cursor-pointer appearance-none`}
          >
            {PAX_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} passenger{n === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </Field>
        <button
          type="submit"
          className="inline-flex max-w-full flex-none items-center justify-center gap-[10px] whitespace-nowrap border-0 bg-clearance px-6 text-[15px] font-bold text-white transition-colors hover:bg-clearance-hover max-sm:h-12 max-sm:flex-[1_1_100%]"
        >
          Request a quote <span aria-hidden="true">↗</span>
        </button>
      </div>

      <p
        role={msg?.tone === "error" ? "alert" : "status"}
        className={`mt-[10px] px-1 text-[12px] ${msg?.tone === "error" ? "text-danger" : msg?.tone === "success" ? "text-success" : "text-steel"}`}
      >
        {msg ? msg.text : "Tell us your plans. We’ll help shape the details."}
      </p>
    </form>
  );
}
