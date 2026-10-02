"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { retryMessageDelivery, type RetryResult } from "@/app/admin/messages/retry-actions";
import { channelSentence, messageWhen, shortAddress } from "@/components/admin/messages/words";

export type FailedDeliveryRow = {
  id: string;
  subjectType: "quote" | "trip";
  subjectId: string;
  subjectCode: string | null;
  /** Client name for the row ("Dana Whitfield"); falls back to the address. */
  name?: string | null;
  channel?: string | null;
  toAddress: string | null;
  preview: string | null;
  error: string | null;
  occurredAt: Date | null;
};

/**
 * Messages › Problems: outbound texts / emails the provider rejected in
 * the last 7 days. "Retry" sends the same body to the same address; a row
 * that goes through leaves the list.
 */
export function FailedDeliveryList({ initial, now }: { initial: FailedDeliveryRow[]; now?: Date }) {
  const [rows, setRows] = useState(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [resultById, setResultById] = useState<Record<string, RetryResult>>({});
  const [, startTransition] = useTransition();
  const at = now ?? new Date();

  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line-2 bg-surface p-10 text-center">
        <p className="text-[19px] text-bone">Everything sent.</p>
        <p className="mt-1.5 text-bone-2">No texts or emails failed in the last 7 days.</p>
      </div>
    );
  }

  function onRetry(id: string) {
    setPendingId(id);
    startTransition(async () => {
      const r = await retryMessageDelivery(id);
      setResultById((prev) => ({ ...prev, [id]: r }));
      setPendingId(null);
      // Sent rows leave the list so it visibly shrinks.
      if (r.ok && r.status === "sent") {
        setRows((prev) => prev.filter((x) => x.id !== id));
      }
    });
  }

  return (
    <ul className="card overflow-hidden">
      {rows.map((r) => {
        const result = resultById[r.id];
        const busy = pendingId === r.id;
        const threadHref = `/admin/messages?tab=problems&t=${r.subjectType}:${r.subjectId}`;
        const pageHref = r.subjectType === "quote" ? `/admin/requests/${r.subjectId}` : `/admin/trips/${r.subjectId}`;
        const title = `${channelSentence(r.channel ?? "")} to ${r.name ?? shortAddress(r.toAddress)} didn't send`;
        return (
          <li
            key={r.id}
            className="grid grid-cols-1 gap-3 border-b border-line-faint px-5 py-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-6"
          >
            <div className="min-w-0">
              <p className="text-[16px] text-bone">
                {title}
                {r.occurredAt ? <span className="text-steel"> · {messageWhen(r.occurredAt, at)}</span> : null}
              </p>
              <p className="mt-0.5 text-[14px] text-steel">
                {r.toAddress ?? "No address on file"}
                {r.preview ? <> · &ldquo;{r.preview}&rdquo;</> : null}
              </p>
              {r.error ? <p className="mt-1 text-[13px] text-danger">{r.error}</p> : null}
              {result ? (
                <p
                  role="status"
                  className={`mt-1 text-[13px] ${result.ok && result.status === "sent" ? "text-success" : "text-danger"}`}
                >
                  {result.ok && result.status === "sent"
                    ? "Sent."
                    : result.ok
                      ? `Still didn't send${result.error ? ` · ${result.error.slice(0, 120)}` : ""}`
                      : `Couldn't retry · ${result.error.replace(/_/g, " ").toLowerCase()}`}
                </p>
              ) : null}
              <p className="mt-1.5 flex flex-wrap gap-x-4 text-[14px]">
                <Link href={threadHref} className="text-link">
                  Open thread
                </Link>
                <Link href={pageHref} className="text-link">
                  {r.subjectType === "quote" ? "Open request" : "Open trip"}
                </Link>
              </p>
            </div>
            <button
              type="button"
              onClick={() => onRetry(r.id)}
              disabled={busy}
              className="btn btn-secondary btn-sm disabled:cursor-wait"
            >
              {busy ? "Retrying…" : "Retry"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
