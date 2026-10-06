"use client";

import { useRouter } from "next/navigation";
import type { AircraftCategorySlug } from "@/lib/fleet";
import { useQuoteStore } from "@/lib/quote-store";
import { seedQuote } from "@/lib/start-quote";
import { track } from "@/lib/analytics";

/** Opens the quote wizard with a worked example's lane already loaded. */
export function SampleQuoteButton({
  from,
  to,
  pax,
  category,
  children,
  className = "text-link text-[14px] font-bold",
}: {
  from: string;
  to: string;
  pax: number;
  category: AircraftCategorySlug;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={`cursor-pointer border-0 bg-transparent p-0 ${className}`}
      onClick={() => {
        seedQuote({ trip: "oneway", pax, from, to });
        useQuoteStore.getState().setCategory(category);
        track("quote_launcher_submitted", { context: `route-card:${from}-${to}` });
        router.push("/quote/mission");
      }}
    >
      {children}
    </button>
  );
}
