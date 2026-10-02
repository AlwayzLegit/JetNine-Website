"use client";

import { useState, useTransition } from "react";
import { updateTripStatus } from "@/app/admin/trips/[id]/actions";
import type { Trip } from "@/db/schema/trips";
import { tripState } from "@/lib/desk-status";

type Status = Trip["status"];

// Mirrors `tripStatusEnum` (type-checked below) without pulling drizzle
// into the client bundle. Order = the order a trip moves through them.
const STATUSES = [
  "draft",
  "confirmed",
  "crew_briefed",
  "boarding",
  "airborne",
  "wheels_down",
  "completed",
  "diverted",
  "irregular_ops",
  "cancelled_wx",
  "cancelled_other",
] as const satisfies readonly Status[];

/**
 * Trip status control on the trip sheet. Shows the desk's plain-words
 * sentences (`tripState(...).label`) but submits the database enum values.
 */
export function TripStatusSelect({ tripId, current }: { tripId: string; current: Status }) {
  const [value, setValue] = useState<Status>(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onChange(next: string) {
    const cast = next as Status;
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
    <div className="field-jn">
      <label htmlFor={`trip-status-${tripId}`}>Where this trip is</label>
      <select
        id={`trip-status-${tripId}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={pending}
        aria-busy={pending}
        className="disabled:opacity-60"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {tripState(s).label}
          </option>
        ))}
      </select>
      <p className="mt-1.5 text-[13px] text-steel">
        {pending ? "Saving…" : "Changing it tells the client by email, and by text if they opted in."}
      </p>
      {error ? (
        <p role="alert" className="mt-1.5 text-[13px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
