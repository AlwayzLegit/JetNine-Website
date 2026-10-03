"use client";

import { useState, useTransition } from "react";
import { dismissRunItem } from "@/app/admin/settings/assistant/actions";

/** "Dismiss" on an open flag, note or draft in the run log. */
export function DismissRunItem({ id }: { id: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="text-link text-[14px] disabled:opacity-50"
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const r = await dismissRunItem(id);
            if (!r.ok) setError(r.error);
          });
        }}
      >
        {pending ? "Dismissing…" : "Dismiss"}
      </button>
      {error ? (
        <span role="status" className="text-[13px] text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}
