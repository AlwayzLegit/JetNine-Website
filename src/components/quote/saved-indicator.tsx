"use client";

import { useQuoteStore } from "@/lib/quote-store";

// Draft-autosave word for the step footer: "Draft saves automatically"
// until the store has written once, then "Saved". Rendered inline after
// "Step n of 4 · " by StepFooter; the store's `savedAt` is set by every
// mutator, so it flips on the first edit.
export function SavedIndicator({ className = "" }: { className?: string }) {
  const savedAt = useQuoteStore((s) => s.savedAt);
  return (
    <span className={className} aria-live="polite">
      {savedAt ? "Saved" : "Draft saves automatically"}
    </span>
  );
}
