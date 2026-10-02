"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { useQuoteStore, type TripType } from "@/lib/quote-store";

type FieldKey = "from" | "to" | "depart" | "return";
type FieldErrors = Partial<Record<FieldKey, true>>;

const TRIP_TYPES: { id: TripType; label: string }[] = [
  { id: "roundtrip", label: "Round trip" },
  { id: "oneway", label: "One way" },
  { id: "multileg", label: "Multi-leg" },
];

const FIELD_WORDS: Record<FieldKey, string> = {
  from: "where you're flying from",
  to: "where you're flying to",
  depart: "a departure date",
  return: "a return date",
};

const MIN_PAX = 1;
const MAX_PAX = 16;

const inputClass =
  "w-full bg-transparent text-[16px] leading-[1.4] text-bone outline-none [color-scheme:dark] placeholder:text-steel disabled:cursor-default";

/**
 * Compact hero field from the Home prototype: the 13px label sits inside
 * the surface-2 box above the value. Focus and error rings match
 * `.field-jn` so the search card reads as the same input family.
 */
function Field({
  label,
  error,
  className = "",
  children,
}: {
  label: string;
  error?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label
      className={[
        "flex flex-col gap-1 rounded-control bg-surface-2 px-[14px] py-[10px] transition-shadow duration-150 focus-within:shadow-[0_0_0_1px_var(--clearance)]",
        error ? "shadow-[0_0_0_1px_var(--danger)]" : "",
        className,
      ].join(" ")}
    >
      <span className={`text-[13px] leading-[1.4] ${error ? "text-danger" : "text-bone-2"}`}>
        {label}
      </span>
      {children}
    </label>
  );
}

/**
 * Search card inside the Home hero. State: `trip` (round trip · one way ·
 * multi-leg) and `pax` 1–16. On search it seeds the quote store and hands
 * off to /quote/mission — the same handoff the previous booking widget
 * made, so the wizard's mission step opens pre-filled.
 */
export function SearchCard() {
  const router = useRouter();
  const [trip, setTrip] = useState<TripType>("roundtrip");
  const [pax, setPax] = useState(2);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [msg, setMsg] = useState<{ tone: "info" | "error" | "success"; text: string } | null>(
    null,
  );

  const oneWay = trip === "oneway";

  function changeTrip(next: TripType) {
    setTrip(next);
    setErrors({});
    setMsg(
      next === "multileg"
        ? { tone: "info", text: "Multi-leg: add up to five legs after you search." }
        : null,
    );
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const required: FieldKey[] = ["from", "to", "depart"];
    if (trip === "roundtrip") required.push("return");

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
    if (trip === "roundtrip" && legs[1]) {
      store.updateLeg(legs[1].id, { date: (data.get("return") as string) || undefined });
    }

    setMsg({ tone: "success", text: "Opening your quote…" });
    router.push("/quote/mission");
  }

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="card mt-10 max-w-[1080px] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.45)] max-md:mt-6"
    >
      <div role="group" aria-label="Trip type" className="segmented mb-3 max-md:flex max-md:w-full">
        {TRIP_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => changeTrip(t.id)}
            aria-pressed={trip === t.id}
            className="max-md:h-11 max-md:flex-1"
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 md:[grid-template-columns:1.3fr_1.3fr_1fr_1fr_0.9fr_auto]">
        <Field label="From" error={errors.from} className="max-md:col-span-2">
          <input
            name="from"
            type="text"
            placeholder="City or airport"
            autoComplete="off"
            aria-invalid={errors.from ? true : undefined}
            className={inputClass}
          />
        </Field>
        <Field label="To" error={errors.to} className="max-md:col-span-2">
          <input
            name="to"
            type="text"
            placeholder="City or airport"
            autoComplete="off"
            aria-invalid={errors.to ? true : undefined}
            className={inputClass}
          />
        </Field>
        <Field label="Depart" error={errors.depart}>
          <input
            name="depart"
            type="date"
            aria-invalid={errors.depart ? true : undefined}
            className={inputClass}
          />
        </Field>
        <Field label="Return" error={errors.return} className={oneWay ? "opacity-[0.45]" : ""}>
          {oneWay ? (
            <input type="text" placeholder="One way" disabled className={inputClass} />
          ) : (
            <input
              name="return"
              type="date"
              aria-invalid={errors.return ? true : undefined}
              className={inputClass}
            />
          )}
        </Field>

        <div className="flex flex-col gap-1 rounded-control bg-surface-2 px-[14px] py-[10px] max-md:col-span-2 max-md:flex-row max-md:items-center max-md:justify-between max-md:py-[6px]">
          <span id="search-pax-label" className="text-[13px] leading-[1.4] text-bone-2 max-md:text-[15px] max-md:text-bone">
            Passengers
          </span>
          <div
            role="group"
            aria-labelledby="search-pax-label"
            className="stepper max-md:gap-2 max-md:[&>button]:h-11 max-md:[&>button]:w-11"
          >
            <button
              type="button"
              onClick={() => setPax((n) => Math.max(MIN_PAX, n - 1))}
              disabled={pax <= MIN_PAX}
              aria-label="Fewer passengers"
            >
              −
            </button>
            <span className="min-w-[24px] text-center text-[16px]" aria-live="polite">
              {pax}
            </span>
            <button
              type="button"
              onClick={() => setPax((n) => Math.min(MAX_PAX, n + 1))}
              disabled={pax >= MAX_PAX}
              aria-label="More passengers"
            >
              +
            </button>
          </div>
        </div>

        <button type="submit" className="btn btn-primary btn-lg h-auto min-h-[52px] max-md:col-span-2">
          Search <span className="arrow" aria-hidden="true">→</span>
        </button>
      </div>

      <div className="mt-3 flex justify-end max-md:justify-center">
        {msg ? (
          <p
            role={msg.tone === "error" ? "alert" : "status"}
            className={[
              "text-[14px]",
              msg.tone === "error"
                ? "text-danger"
                : msg.tone === "success"
                  ? "text-success"
                  : "text-bone-2",
            ].join(" ")}
          >
            {msg.text}
          </p>
        ) : (
          <Link href="/contact" className="text-link tap-pad text-[14px]">
            Need help choosing? Talk to a flight advisor →
          </Link>
        )}
      </div>
    </form>
  );
}
