"use client";

import { useState, useTransition } from "react";
import { releaseSoftHold } from "@/app/admin/quote/[id]/actions";

export type HeldAircraft = {
  blockId: string;
  aircraftId: string;
  tailNumber: string;
  makeModel: string;
  startAt: Date;
  endAt: Date;
};

export function SoftHoldList({
  quoteId,
  initial,
}: {
  quoteId: string;
  initial: HeldAircraft[];
}) {
  const [list, setList] = useState<HeldAircraft[]>(initial);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  function onRelease(blockId: string) {
    setMsg(null);
    startTransition(async () => {
      const result = await releaseSoftHold(quoteId, blockId);
      if (result.ok) {
        setList((prev) => prev.filter((h) => h.blockId !== blockId));
        setMsg({ tone: "ok", text: "RELEASED." });
      } else {
        setMsg({ tone: "error", text: `BLOCKED — ${result.error.toUpperCase()}` });
      }
    });
  }

  if (list.length === 0) {
    return (
      <p className="text-[12px] text-steel">
        — No active soft holds. Use the candidates list to put an airframe on hold while sourcing.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {list.map((h) => (
          <li
            key={h.blockId}
            className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-[3px] border border-dashed border-clearance bg-ink p-3"
          >
            <div className="min-w-0">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[12px] tracking-[0.04em] text-clearance">
                  {h.tailNumber}
                </span>
                <span className="font-serif text-[13px] leading-none text-bone">
                  {h.makeModel}
                </span>
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-bone-2">
                {h.startAt.toISOString().slice(0, 16).replace("T", " ")} →{" "}
                {h.endAt.toISOString().slice(0, 16).replace("T", " ")} UTC
              </div>
            </div>
            <button
              type="button"
              onClick={() => onRelease(h.blockId)}
              disabled={pending}
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-[var(--error)] disabled:cursor-wait disabled:opacity-50"
            >
              Release →
            </button>
          </li>
        ))}
      </ul>
      {msg ? (
        <span
          className={[
            "font-mono text-[10px] uppercase tracking-[0.12em]",
            msg.tone === "error" ? "text-[var(--error)]" : "text-[var(--success)]",
          ].join(" ")}
        >
          {msg.text}
        </span>
      ) : null}
    </div>
  );
}
