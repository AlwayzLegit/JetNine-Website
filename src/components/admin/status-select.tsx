"use client";

import { useState, useTransition } from "react";
import { updateQuoteStatus } from "@/app/admin/requests/[id]/actions";

const STATUSES = [
  "draft",
  "submitted",
  "triaged",
  "sourcing",
  "options_sent",
  "held",
  "accepted",
  "declined",
  "expired",
  "cancelled",
  "converted",
] as const;

// The desk reads statuses as sentences; the enum stays in the database.
const STATUS_WORDS: Record<(typeof STATUSES)[number], string> = {
  draft: "Draft",
  submitted: "Needs a reply",
  triaged: "Working on it · triaged",
  sourcing: "Working on it · sourcing aircraft",
  options_sent: "Options sent",
  held: "Options sent · aircraft held",
  accepted: "Client picked an option",
  declined: "Client went elsewhere",
  expired: "Expired without a reply",
  cancelled: "Cancelled",
  converted: "Booked · now a trip",
};

export function StatusSelect({
  quoteId,
  current,
}: {
  quoteId: string;
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
      const result = await updateQuoteStatus(quoteId, cast);
      if (!result.ok) {
        setError(result.error);
        setValue(current);
      }
    });
  }

  return (
    <div className={`field-jn ${error ? "error" : ""}`}>
      <label htmlFor={`status-${quoteId}`}>Status</label>
      <select
        id={`status-${quoteId}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={pending}
        className="disabled:opacity-60"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_WORDS[s]}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1.5 text-[13px] text-danger">{error}</p> : null}
    </div>
  );
}
