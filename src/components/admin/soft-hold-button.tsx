"use client";

import { useState, useTransition } from "react";
import { createSoftHold } from "@/app/admin/quote/[id]/actions";

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
        setMsg({
          tone: "ok",
          text: `HELD until ${result.expiresAt.slice(11, 16)}Z`,
        });
      } else {
        setMsg({ tone: "error", text: result.error.toUpperCase() });
      }
    });
  }

  if (held) {
    return (
      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-clearance">
        — HELD
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2">
      {msg ? (
        <span
          className={[
            "font-mono text-[9px] uppercase tracking-[0.12em]",
            msg.tone === "error" ? "text-[var(--error)]" : "text-[var(--success)]",
          ].join(" ")}
        >
          {msg.text}
        </span>
      ) : null}
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="font-mono text-[9px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-clearance disabled:cursor-wait disabled:opacity-50"
      >
        {pending ? "Holding…" : "Soft-hold →"}
      </button>
    </span>
  );
}
