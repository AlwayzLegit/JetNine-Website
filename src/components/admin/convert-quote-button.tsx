"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { convertQuoteToTrip } from "@/app/admin/quote/[id]/actions";

export function ConvertQuoteButton({
  quoteId,
  alreadyConvertedTripId,
  status,
}: {
  quoteId: string;
  alreadyConvertedTripId: string | null;
  status: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (alreadyConvertedTripId) {
    return (
      <a
        href={`/admin/trip/${alreadyConvertedTripId}`}
        className="inline-flex items-center gap-2 rounded-[2px] border border-[var(--success)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--success)] transition-colors hover:bg-[rgba(91,140,90,0.08)]"
      >
        Converted → trip
      </a>
    );
  }

  const enabled = ["submitted", "triaged", "sourcing", "options_sent", "held", "accepted"].includes(status);

  function onClick() {
    setError(null);
    startTransition(async () => {
      const result = await convertQuoteToTrip(quoteId);
      if (result.ok) {
        router.push(`/admin/trip`);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={!enabled || pending}
        className="rounded-[2px] border border-clearance bg-clearance px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Converting…" : "Convert to trip"}
      </button>
      {error ? (
        <span className="max-w-[220px] text-right font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--error)]">
          {error}
        </span>
      ) : null}
    </div>
  );
}
