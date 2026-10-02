"use client";

import { useState, useTransition } from "react";
import { createSoftHold } from "@/app/admin/requests/[id]/actions";

const UNTIL_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Los_Angeles",
});

export function SoftHoldButton({
  quoteId,
  aircraftId,
  alreadyHeld,
}: {
  quoteId: string;
  aircraftId: string;
  alreadyHeld: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [held, setHeld] = useState(alreadyHeld);

  function onClick() {
    if (held || pending) return;
    setMsg(null);
    startTransition(async () => {
      const result = await createSoftHold(quoteId, aircraftId);
      if (result.ok) {
        setHeld(true);
        setMsg({ tone: "ok", text: `Held until ${UNTIL_FMT.format(new Date(result.expiresAt))}` });
      } else {
        setMsg({ tone: "error", text: result.error });
      }
    });
  }

  if (held) {
    return (
      <span className="text-[14px] text-clearance">
        Held{msg?.tone === "ok" ? <span className="text-steel"> · {msg.text.replace(/^Held /, "")}</span> : null}
      </span>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2.5">
      {msg ? (
        <span className={`text-[13px] ${msg.tone === "error" ? "text-danger" : "text-success"}`}>{msg.text}</span>
      ) : null}
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="btn btn-secondary btn-sm disabled:cursor-wait"
      >
        {pending ? "Holding…" : "Hold this aircraft"}
      </button>
    </span>
  );
}
