"use client";

import { useState, useTransition } from "react";
import { updateTripStatus } from "@/app/admin/trip/[id]/actions";

const STATUSES = [
  "draft",
  "confirmed",
  "crew_briefed",
  "boarding",
  "airborne",
  "wheels_down",
  "completed",
  "cancelled_wx",
  "cancelled_other",
  "diverted",
  "irregular_ops",
] as const;

export function TripStatusSelect({
  tripId,
  current,
}: {
  tripId: string;
  current: (typeof STATUSES)[number];
}) {
  const [value, setValue] = useState<(typeof STATUSES)[number]>(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onChange(next: string) {
    const cast = next as (typeof STATUSES)[number];
    setValue(cast);
    setError(null);
    startTransition(async () => {
      const result = await updateTripStatus(tripId, cast);
      if (!result.ok) {
        setError(result.error);
        setValue(current);
      }
    });
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <label
        htmlFor={`trip-status-${tripId}`}
        className="font-mono text-[9px] uppercase tracking-[0.14em] text-steel"
      >
        — Trip status
      </label>
      <select
        id={`trip-status-${tripId}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={pending}
        className="rounded-[2px] border border-ink-3 bg-ink-2 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-bone disabled:opacity-60"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      {error ? (
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--error)]">
          {error}
        </span>
      ) : null}
    </div>
  );
}
