"use client";

import { useState, useTransition } from "react";
import { updateEmptyLegStatus } from "@/app/admin/empty-leg/actions";

const STATUSES = ["draft", "scheduled", "live", "sold", "cancelled", "expired"] as const;

const TONE: Record<string, string> = {
  draft: "border-ink-3 text-bone-2",
  scheduled: "border-bone-2 text-bone-2",
  live: "border-clearance text-clearance",
  sold: "border-[var(--success)] text-[var(--success)]",
  cancelled: "border-[var(--error)] text-[var(--error)]",
  expired: "border-steel text-steel",
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
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={pending}
        aria-label="Empty leg status"
        className={[
          "rounded-full border bg-transparent px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] disabled:opacity-60",
          TONE[value] ?? "border-ink-3 text-bone-2",
        ].join(" ")}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s} className="bg-ink text-bone">
            {s}
          </option>
        ))}
      </select>
      {error ? (
        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--error)]">
          {error}
        </span>
      ) : null}
    </div>
  );
}
