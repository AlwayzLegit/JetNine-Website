"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createScheduleBlock } from "@/app/admin/ops/actions";

const KINDS = [
  { id: "maintenance", label: "Maintenance", desc: "C-check, inspection, scheduled work." },
  { id: "repositioning", label: "Reposition", desc: "Ferry to or from another base." },
  { id: "crew_rest", label: "Crew rest", desc: "Part 117 / 135.273 rest." },
  { id: "owner", label: "Owner-private", desc: "Owner, fractional or joint use." },
  { id: "unavailable", label: "Unavailable", desc: "Catch-all hard block." },
] as const;

type AircraftOption = {
  id: string;
  tailNumber: string;
  makeModel: string;
  category: string;
};

export function ScheduleBlockForm({
  aircraftOptions,
}: {
  aircraftOptions: AircraftOption[];
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<string>("maintenance");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const needsRoute = kind === "repositioning";

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setMsg(null);

    startTransition(async () => {
      const result = await createScheduleBlock(data);
      if (result.ok) {
        setMsg({ tone: "ok", text: "Posted — the board has been refreshed." });
        form.reset();
        setKind("maintenance");
      } else {
        setMsg({ tone: "error", text: result.error });
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-secondary btn-sm"
      >
        + Block an aircraft <span className="arrow">→</span>
      </button>
    );
  }

  return (
    <div className="card card-highlight w-full p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-[12px] font-bold uppercase tracking-[0.2em] text-gold">Block an aircraft</h3>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setMsg(null);
          }}
          className="btn btn-secondary h-9 px-3.5 text-[14px]"
        >
          Close
        </button>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.4fr_1fr]">
          <div className="field-jn">
            <label htmlFor="sb-aircraft">Aircraft</label>
            <select id="sb-aircraft" name="aircraftId" required defaultValue="">
              <option value="" disabled>
                Pick an aircraft
              </option>
              {aircraftOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.tailNumber} — {a.makeModel} ({a.category})
                </option>
              ))}
            </select>
          </div>
          <div className="field-jn">
            <label htmlFor="sb-kind">Kind</label>
            <select
              id="sb-kind"
              name="kind"
              required
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label} — {k.desc}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="field-jn">
            <label htmlFor="sb-start">Start (UTC)</label>
            <input id="sb-start" name="startAt" type="datetime-local" required />
          </div>
          <div className="field-jn">
            <label htmlFor="sb-end">End (UTC)</label>
            <input id="sb-end" name="endAt" type="datetime-local" required />
          </div>
        </div>

        {needsRoute ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="field-jn">
              <label htmlFor="sb-fromIcao">From (ICAO)</label>
              <input
                id="sb-fromIcao"
                name="fromIcao"
                type="text"
                placeholder="KTEB"
                maxLength={4}              />
            </div>
            <div className="field-jn">
              <label htmlFor="sb-toIcao">To (ICAO)</label>
              <input
                id="sb-toIcao"
                name="toIcao"
                type="text"
                placeholder="KVNY"
                maxLength={4}              />
            </div>
          </div>
        ) : null}

        <div className="field-jn">
          <label htmlFor="sb-notes">Notes</label>
          <input
            id="sb-notes"
            name="notes"
            type="text"
            placeholder="Phase II 600-hour inspection at LHM"
            maxLength={200}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {msg ? (
            <span className={`text-[14px] ${msg.tone === "error" ? "text-danger" : "text-success"}`}>
              {msg.text}
            </span>
          ) : (
            <span className="text-[13px] text-steel">
              Trip and soft-hold blocks are managed automatically; pick a manual kind.
            </span>
          )}
          <button
            type="submit"
            disabled={pending}
            className="btn btn-primary btn-sm disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? "Posting…" : "Post block"} <span className="arrow">→</span>
          </button>
        </div>
      </form>
    </div>
  );
}
