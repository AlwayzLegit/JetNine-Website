"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { addLane, deleteLane } from "./actions";
import { AIRPORTS } from "@/lib/airports";
import type { MemberLane } from "@/db/schema/member-prefs";

type Props = { initial: MemberLane[] };

// Lookup table for pretty display ("KTEB" → "New York · TEB").
const AIRPORT_BY_ICAO = new Map(AIRPORTS.map((a) => [a.icao, a]));

function prettyAirport(icao: string): string {
  const a = AIRPORT_BY_ICAO.get(icao);
  if (!a) return icao;
  return `${a.city} · ${a.iata}`;
}

export function LanesSection({ initial }: Props) {
  const [list, setList] = useState<MemberLane[]>(initial);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  // Datalist option set — let the browser do the autocomplete heavy lifting.
  const datalistOptions = useMemo(
    () =>
      AIRPORTS.map((a) => ({
        value: a.icao,
        label: `${a.icao} — ${a.city} (${a.iata}) · ${a.name}`,
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
        setMsg({ tone: "ok", text: `ADDED — ${fromIcao}→${toIcao} on watchlist.` });
        form.reset();
      } else {
        setMsg({ tone: "error", text: `BLOCKED — ${result.error.toUpperCase()}` });
      }
    });
  }

  function onDelete(id: string) {
    setMsg(null);
    startTransition(async () => {
      const result = await deleteLane(id);
      if (result.ok) {
        setList((prev) => prev.filter((l) => l.id !== id));
        setMsg({ tone: "ok", text: "REMOVED." });
      } else {
        setMsg({ tone: "error", text: `BLOCKED — ${result.error.toUpperCase()}` });
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {list.length === 0 ? (
        <p className="rounded-[2px] border border-dashed border-ink-3 bg-ink-2 p-6 font-mono text-[11px] uppercase tracking-[0.1em] text-bone-2">
          — No lanes on file. Add the routes you fly most so dispatch can route empty-leg matches
          and pre-position fleet before you ask.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((l) => (
            <li
              key={l.id}
              className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-[2px] border border-ink-3 bg-ink-2 px-5 py-4"
            >
              <div className="min-w-0">
                <div className="font-serif text-[17px] text-bone">
                  {prettyAirport(l.fromIcao)}{" "}
                  <span className="text-clearance">→</span> {prettyAirport(l.toIcao)}
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-bone-2">
                  {l.fromIcao} → {l.toIcao}
                  {l.frequencyPerYear ? ` · ~${l.frequencyPerYear}×/yr` : ""}
                  {l.seasonal ? " · seasonal" : ""}
                  {l.lastFlownAt
                    ? ` · last flown ${new Date(l.lastFlownAt).toISOString().slice(0, 10)}`
                    : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onDelete(l.id)}
                disabled={pending}
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-[var(--error)] disabled:cursor-wait disabled:opacity-50"
              >
                Remove →
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onAdd} className="rounded-[2px] border border-ink-3 bg-ink-2 p-5">
        <p className="caption mb-4">— Add lane</p>
        <datalist id="lane-icao-list">
          {datalistOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </datalist>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="field-jn">
            <label htmlFor="ln-fromIcao">From (ICAO)</label>
            <input
              id="ln-fromIcao"
              name="fromIcao"
              type="text"
              placeholder="KVNY"
              list="lane-icao-list"
              required
              maxLength={4}
              minLength={3}
              style={{ textTransform: "uppercase" }}
            />
          </div>
          <div className="field-jn">
            <label htmlFor="ln-toIcao">To (ICAO)</label>
            <input
              id="ln-toIcao"
              name="toIcao"
              type="text"
              placeholder="KTEB"
              list="lane-icao-list"
              required
              maxLength={4}
              minLength={3}
              style={{ textTransform: "uppercase" }}
            />
          </div>
          <div className="field-jn">
            <label htmlFor="ln-frequency">Frequency (per year)</label>
            <input
              id="ln-frequency"
              name="frequencyPerYear"
              type="number"
              min={1}
              max={365}
              placeholder="12"
            />
          </div>
          <label className="flex h-full cursor-pointer items-center gap-3 rounded-[2px] border border-ink-3 bg-ink p-5">
            <input type="checkbox" name="seasonal" className="h-4 w-4 accent-clearance" />
            <div>
              <div className="font-serif text-[15px] text-bone">Seasonal</div>
              <div className="mt-1 text-[12px] leading-[1.5] text-bone-2">
                Only certain months — dispatch will skip out-of-season alerts.
              </div>
            </div>
          </label>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
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
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
              — Lanes feed empty-leg matching + pre-positioning. Direction matters.
            </span>
          )}
          <button
            type="submit"
            disabled={pending}
            className="btn btn-primary btn-sm disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? "Adding…" : "Add lane"} <span className="arrow">→</span>
          </button>
        </div>
      </form>
    </div>
  );
}
