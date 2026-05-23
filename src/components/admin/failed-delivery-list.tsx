"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { retryMessageDelivery, type RetryResult } from "@/app/admin/dispatch/actions";

export type FailedDeliveryRow = {
  id: string;
  subjectType: "quote" | "trip";
  subjectId: string;
  subjectCode: string | null;
  toAddress: string | null;
  preview: string | null;
  error: string | null;
  occurredAt: Date | null;
};

export function FailedDeliveryList({ initial }: { initial: FailedDeliveryRow[] }) {
  const [rows, setRows] = useState(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [resultById, setResultById] = useState<Record<string, RetryResult>>({});
  const [, startTransition] = useTransition();

  if (rows.length === 0) {
    return (
      <p className="rounded-[2px] border border-dashed border-ink-3 bg-ink p-5 font-mono text-[10px] uppercase tracking-[0.1em] text-bone-2">
        — No failed deliveries in the last 7 days. Mail is leaving the building.
      </p>
    );
  }

  function onRetry(id: string) {
    setPendingId(id);
    startTransition(async () => {
      const r = await retryMessageDelivery(id);
      setResultById((prev) => ({ ...prev, [id]: r }));
      setPendingId(null);
      // Optimistically remove sent rows so the list visibly shrinks.
      if (r.ok && r.status === "sent") {
        setRows((prev) => prev.filter((x) => x.id !== id));
      }
    });
  }

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => {
        const result = resultById[r.id];
        const busy = pendingId === r.id;
        const detailHref =
          r.subjectType === "quote"
            ? `/admin/quote/${r.subjectId}`
            : `/admin/trip/${r.subjectId}`;
        return (
          <li
            key={r.id}
            className="rounded-[3px] border border-[var(--error)] bg-ink p-4"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <Link
                href={detailHref}
                className="font-mono text-[11px] uppercase tracking-[0.14em] text-clearance hover:text-bone"
              >
                — {r.subjectCode ?? r.subjectType.toUpperCase()}
              </Link>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
                {r.occurredAt
                  ? r.occurredAt.toISOString().slice(0, 16).replace("T", " ") + " UTC"
                  : "—"}
              </span>
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-bone-2">
              TO: <span className="text-bone">{r.toAddress ?? "—"}</span>
            </div>
            <p className="mt-2 text-[13px] leading-[1.55] text-bone">{r.preview ?? "—"}</p>
            {r.error ? (
              <p className="mt-2 font-mono text-[10px] leading-[1.4] text-[var(--error)]">
                delivery error: {r.error}
              </p>
            ) : null}
            <div className="mt-3 flex items-center justify-between gap-3">
              {result ? (
                <span
                  className={[
                    "font-mono text-[10px] uppercase tracking-[0.12em]",
                    result.ok && result.status === "sent"
                      ? "text-[var(--success)]"
                      : "text-[var(--error)]",
                  ].join(" ")}
                >
                  {result.ok && result.status === "sent"
                    ? `SENT · ${result.provider}`
                    : result.ok
                      ? `STILL FAILED · ${result.error?.slice(0, 80) ?? "?"}`
                      : `BLOCKED · ${result.error}`}
                </span>
              ) : (
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-steel" />
              )}
              <button
                type="button"
                onClick={() => onRetry(r.id)}
                disabled={busy}
                className="btn btn-secondary btn-sm disabled:cursor-wait disabled:opacity-60"
              >
                {busy ? "Retrying…" : "Retry"} <span className="arrow">→</span>
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
