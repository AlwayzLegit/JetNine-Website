"use client";

import { useState } from "react";

/** Copies a text template to the clipboard ("Copy trip-request template ⧉"). */
export function CopyButton({ text, label, className = "" }: { text: string; label: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        navigator.clipboard?.writeText(text).then(
          () => setDone(true),
          () => setDone(false),
        );
      }}
    >
      {done ? "Template copied" : label} <span aria-hidden="true">{done ? "✓" : "⧉"}</span>
    </button>
  );
}
