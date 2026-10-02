"use client";

import { useState, useTransition } from "react";
import { updateEmptyLegStatus } from "@/app/admin/empty-leg/actions";

const STATUSES = ["draft", "scheduled", "live", "sold", "cancelled", "expired"] as const;

const WORDS: Record<(typeof STATUSES)[number], string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  live: "Live",
  sold: "Sold",
  cancelled: "Cancelled",
  expired: "Expired",
};

const DOT: Record<string, string> = {
  draft: "dot",
  scheduled: "dot",
  live: "dot dot-success",
  sold: "dot dot-gold",
  cancelled: "dot dot-danger",
  expired: "dot",
};

export function EmptyLegStatusSelect({
  legId,
  current,
}: {
  legId: string;
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
      const result = await updateEmptyLegStatus(legId, cast);
      if (!result.ok) {
        setError(result.error);
        setValue(current);
      }
    });
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <span className="pill pill-outline h-8 gap-2 pr-2">
        <span className={DOT[value] ?? "dot"} aria-hidden="true" />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={pending}
          aria-label="Empty leg status"
          className="cursor-pointer appearance-none bg-transparent pr-4 text-[13px] font-medium text-bone outline-none disabled:opacity-60"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s} className="bg-ink text-bone">
              {WORDS[s]}
            </option>
          ))}
        </select>
        <span aria-hidden="true" className="-ml-5 text-[11px] text-steel">
          ▾
        </span>
      </span>
      {error ? <span className="text-[13px] text-danger">{error}</span> : null}
    </div>
  );
}
