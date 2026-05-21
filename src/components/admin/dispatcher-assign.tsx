"use client";

import { useState, useTransition } from "react";
import { assignDispatcher } from "@/app/admin/quote/[id]/actions";

type Dispatcher = { id: string; displayName: string };

export function DispatcherAssign({
  quoteId,
  current,
  dispatchers,
}: {
  quoteId: string;
  current: { id: string; displayName: string } | null;
  dispatchers: Dispatcher[];
}) {
  const [assignedId, setAssignedId] = useState<string>(current?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onChange(next: string) {
    const value = next || null;
    setAssignedId(value ?? "");
    setError(null);
    startTransition(async () => {
      const result = await assignDispatcher(quoteId, value);
      if (!result.ok) {
        setError(result.error);
        setAssignedId(current?.id ?? "");
      }
    });
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <label
        htmlFor={`assign-${quoteId}`}
        className="font-mono text-[9px] uppercase tracking-[0.14em] text-steel"
      >
        — Dispatcher
      </label>
      <select
        id={`assign-${quoteId}`}
        value={assignedId}
        onChange={(e) => onChange(e.target.value)}
        disabled={pending}
        className="rounded-[2px] border border-ink-3 bg-ink-2 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-bone disabled:opacity-60"
      >
        <option value="">— Unassigned —</option>
        {dispatchers.map((d) => (
          <option key={d.id} value={d.id}>
            {d.displayName}
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
