"use client";

import { useEffect, useState } from "react";
import { useQuoteStore } from "@/lib/quote-store";

function relative(savedAt: number, now: number): string {
  const diffMs = now - savedAt;
  if (diffMs < 5_000) return "just now";
  if (diffMs < 60_000) return `${Math.floor(diffMs / 1000)}s ago`;
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)} min ago`;
  return `${Math.floor(diffMs / 3_600_000)}h ago`;
}

export function SavedIndicator() {
  const savedAt = useQuoteStore((s) => s.savedAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!savedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, [savedAt]);

  if (!savedAt) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-steel">
        — Not yet saved
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-bone-2">
      <span className="text-clearance">✓</span> Saved automatically · {relative(savedAt, now)}
    </span>
  );
}
