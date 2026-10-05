"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { addLane, deleteLane } from "./actions";
import { AIRPORTS } from "@/lib/airports";
import type { MemberLane } from "@/db/schema/member-prefs";
import { PreferencesToggle } from "@/components/account/preferences-toggle";
import { PreferencesFeedback, errorSentence, type Feedback } from "@/components/account/preferences-feedback";

type Props = { initial: MemberLane[] };

// Lookup table for plain-words display ("KTEB" → "New York (TEB)").
const AIRPORT_BY_CODE = new Map(AIRPORTS.map((a) => [a.icao, a]));

function prettyAirport(icao: string): string {
  const a = AIRPORT_BY_CODE.get(icao);
  if (!a) return icao;
  return `${a.city} (${a.iata})`;
}

const LAST_FLOWN = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * "Routes you fly often" card. Same `addLane` / `deleteLane` actions and
 * validation (airport codes) as before.
 */
export function LanesSection({ initial }: Props) {
  const [list, setList] = useState<MemberLane[]>(initial);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<Feedback>(null);

  // Datalist option set — let the browser do the autocomplete heavy lifting.
  const datalistOptions = useMemo(
    () =>
      AIRPORTS.map((a) => ({
        value: a.icao,
        label: `${a.city} (${a.iata}) · ${a.name}`,
      })),
    [],
  );

  function onAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setMsg(null);

    startTransition(async () => {
      const result = await addLane(data);
      if (result.ok) {
        const fromIcao = ((data.get("fromIcao") as string) ?? "").toUpperCase();
        const toIcao = ((data.get("toIcao") as string) ?? "").toUpperCase();
        const freqRaw = (data.get("frequencyPerYear") as string) ?? "";
        const optimistic: MemberLane = {
          id: result.id,
          memberId: "",
          fromIcao,
          toIcao,
          frequencyPerYear: freqRaw ? Number(freqRaw) : null,
          seasonal: data.get("seasonal") === "on",
          lastFlownAt: null,
          createdAt: new Date(),
        };
        setList((prev) => [...prev, optimistic]);
        setMsg({ tone: "ok", text: `Added ${prettyAirport(fromIcao)} → ${prettyAirport(toIcao)}.` });
        form.reset();
      } else {
        setMsg({ tone: "error", text: errorSentence(result.error) });
      }
    });
  }

  function onDelete(id: string) {
    setMsg(null);
    startTransition(async () => {
      const result = await deleteLane(id);
      if (result.ok) {
        setList((prev) => prev.filter((l) => l.id !== id));
        setMsg({ tone: "ok", text: "Removed." });
      } else {
        setMsg({ tone: "error", text: errorSentence(result.error) });
      }
    });
  }

  return (
    <section className="border border-line bg-surface px-5 py-[18px] md:px-6 md:py-5">
      <h2 className="font-serif text-[20px] font-normal leading-[1.2] text-bone">Routes you fly often</h2>
      <p className="mt-1 max-w-[60ch] text-[14px] leading-[1.5] text-steel">
        Tell dispatch where you fly most. It powers empty-leg matching, aircraft positioning and
        the &ldquo;fly this again&rdquo; shortcut on a new quote.
      </p>

      {list.length === 0 ? (
        <p className="mt-6 text-[15px] leading-[1.55] text-bone-2">
          No routes yet. Add the ones you fly most so dispatch can match empty legs and position
          aircraft before you ask.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {list.map((l) => {
            const facts: string[] = [];
            if (l.frequencyPerYear) {
              facts.push(`about ${l.frequencyPerYear} ${l.frequencyPerYear === 1 ? "time" : "times"} a year`);
            }
            if (l.seasonal) facts.push("seasonal");
            if (l.lastFlownAt) {
              const d = new Date(`${l.lastFlownAt}T12:00:00Z`);
              if (!Number.isNaN(d.getTime())) facts.push(`last flown ${LAST_FLOWN.format(d)}`);
            }
            return (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-4">
                <div className="min-w-0">
                  <div className="font-serif text-[18px] text-bone">
                    {prettyAirport(l.fromIcao)} → {prettyAirport(l.toIcao)}
                  </div>
                  {facts.length ? <div className="mt-0.5 text-[14px] text-bone-2">{facts.join(" · ")}</div> : null}
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(l.id)}
                  disabled={pending}
                  className="text-link min-h-[44px] text-[15px] disabled:cursor-wait disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={onAdd} className="mt-6">
        <h3 className="text-[12px] font-bold uppercase tracking-[.2em] text-gold">Add a route</h3>
        <datalist id="lane-icao-list">
          {datalistOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </datalist>
        <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-3">
          <div className="field-jn">
            <label htmlFor="ln-fromIcao">From (airport code)</label>
            <input
              id="ln-fromIcao"
              name="fromIcao"
              type="text"
              placeholder="KVNY"
              list="lane-icao-list"
              required
              maxLength={4}
              minLength={3}
              autoCapitalize="characters"
            />
          </div>
          <div className="field-jn">
            <label htmlFor="ln-toIcao">To (airport code)</label>
            <input
              id="ln-toIcao"
              name="toIcao"
              type="text"
              placeholder="KTEB"
              list="lane-icao-list"
              required
              maxLength={4}
              minLength={3}
              autoCapitalize="characters"
            />
          </div>
          <div className="field-jn">
            <label htmlFor="ln-frequency">Times a year</label>
            <input id="ln-frequency" name="frequencyPerYear" type="number" min={1} max={365} placeholder="12" />
          </div>
        </div>
        <div className="mt-2.5">
          <PreferencesToggle
            name="seasonal"
            label="Seasonal"
            desc="Only certain months — dispatch skips out-of-season alerts."
            defaultChecked={false}
          />
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-line pt-4">
          <button type="submit" disabled={pending} className="btn btn-primary btn-sm disabled:cursor-wait">
            {pending ? "Saving…" : "Add route"} <span className="arrow">→</span>
          </button>
          {msg ? (
            <PreferencesFeedback msg={msg} />
          ) : (
            <p className="text-[14px] text-steel">Direction matters — add the return separately if you fly it.</p>
          )}
        </div>
      </form>
    </section>
  );
}
