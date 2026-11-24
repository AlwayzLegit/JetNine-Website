"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

// The site chat's launcher button (OPS-242), on the marketing layout only. It asks
// GET /api/chat once, after the page is idle, and shows nothing unless the answer is
// { enabled: true }: with the chat off (budget 0, crew-ai down, no binding) a visitor
// sees no button and no change. The panel and its code load on the first click.

const ChatPanel = dynamic(() => import("./chat-panel"), { ssr: false });

export function ChatLauncher() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    const ask = () => {
      fetch("/api/chat", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { enabled?: unknown } | null) => {
          if (!cancelled && j?.enabled === true) setEnabled(true);
        })
        .catch(() => {});
    };
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const id = idle ? idle(ask) : window.setTimeout(ask, 2500);
    return () => {
      cancelled = true;
      if (!idle) window.clearTimeout(id);
    };
  }, []);

  if (!enabled) return null;
  return (
    <>
      {!open && (
        <button
          ref={button}
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-40 inline-flex min-h-[44px] items-center gap-2 rounded-pill bg-navy px-5 text-[14px] font-bold text-navy-on shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-clearance focus-visible:ring-offset-2"
          aria-haspopup="dialog"
        >
          Ask a question
        </button>
      )}
      {open && (
        <ChatPanel
          onClose={() => {
            setOpen(false);
            // Back to the button, so a keyboard user does not lose their place.
            window.setTimeout(() => button.current?.focus(), 0);
          }}
        />
      )}
    </>
  );
}
