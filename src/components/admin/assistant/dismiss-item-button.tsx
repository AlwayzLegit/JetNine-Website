"use client";

import { useState, useTransition } from "react";
import { dismissAssistantItem } from "@/app/admin/assistant/actions";

/**
 * "Dismiss" on one assistant note. On success the page revalidates and the
 * note is gone; on failure the reason shows next to the button.
 */
export function DismissItemButton({ id, path }: { id: string; path: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function dismiss() {
    setError(null);
    start(async () => {
      const r = await dismissAssistantItem(id, path);
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={dismiss}
        disabled={pending}
        className="text-link whitespace-nowrap text-[14px] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Dismissing…" : "Dismiss"}
      </button>
      {error ? <p className="text-right text-[13px] text-danger">{error}</p> : null}
    </div>
  );
}
