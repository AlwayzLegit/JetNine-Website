"use client";

import { useState, useTransition } from "react";
import { assignDispatcher } from "@/app/admin/requests/[id]/actions";

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
    <div className={`field-jn ${error ? "error" : ""}`}>
      <label htmlFor={`assign-${quoteId}`}>Who is on it</label>
      <select
        id={`assign-${quoteId}`}
        value={assignedId}
        onChange={(e) => onChange(e.target.value)}
        disabled={pending}
        className="disabled:opacity-60"
      >
        <option value="">Nobody yet</option>
        {dispatchers.map((d) => (
          <option key={d.id} value={d.id}>
            {d.displayName}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1.5 text-[13px] text-danger">{error}</p> : null}
    </div>
  );
}
