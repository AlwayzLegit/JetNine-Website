"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { convertQuoteToTrip } from "@/app/admin/requests/[id]/actions";

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
      <a href={`/admin/trips/${alreadyConvertedTripId}`} className="btn btn-secondary btn-sm">
        Open the trip <span className="arrow">→</span>
      </a>
    );
  }

  const enabled = ["submitted", "triaged", "sourcing", "options_sent", "held", "accepted"].includes(status);

  function onClick() {
    setError(null);
    startTransition(async () => {
      const result = await convertQuoteToTrip(quoteId);
      if (result.ok) {
        router.push(`/admin/trips`);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={onClick}
        disabled={!enabled || pending}
        className="btn btn-primary btn-sm self-start disabled:cursor-not-allowed"
      >
        {pending ? "Confirming…" : "Confirm booking → creates a Trip"}
      </button>
      {error ? <p className="text-[13px] leading-[1.45] text-danger">{error}</p> : null}
    </div>
  );
}
