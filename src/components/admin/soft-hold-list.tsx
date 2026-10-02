"use client";

import { useState, useTransition } from "react";
import { releaseSoftHold } from "@/app/admin/requests/[id]/actions";

export type HeldAircraft = {
  blockId: string;
  aircraftId: string;
  tailNumber: string;
  makeModel: string;
  startAt: Date;
  endAt: Date;
};

const WINDOW_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Los_Angeles",
});

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
        setMsg({ tone: "ok", text: "Hold released." });
      } else {
        setMsg({ tone: "error", text: result.error });
      }
    });
  }

  if (list.length === 0) {
    return (
      <p className="text-[14px] text-steel">
        No holds yet. Hold an aircraft from the matches above while you source.
        {msg ? <span className={msg.tone === "error" ? "text-danger" : "text-success"}> {msg.text}</span> : null}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <ul className="flex flex-col gap-2">
        {list.map((h) => (
          <li
            key={h.blockId}
            className="flex items-center justify-between gap-3 rounded-control border border-dashed border-clearance bg-ink px-4 py-3"
          >
            <div className="min-w-0">
              <div className="text-[15px] text-bone">
                {h.makeModel} <span className="text-steel">· {h.tailNumber}</span>
              </div>
              <div className="mt-0.5 text-[13px] text-steel">
                Held {WINDOW_FMT.format(h.startAt)} → {WINDOW_FMT.format(h.endAt)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onRelease(h.blockId)}
              disabled={pending}
              className="text-link text-[14px] disabled:cursor-wait disabled:opacity-50"
            >
              Release
            </button>
          </li>
        ))}
      </ul>
      {msg ? (
        <p className={`text-[13px] ${msg.tone === "error" ? "text-danger" : "text-success"}`}>{msg.text}</p>
      ) : null}
    </div>
  );
}
