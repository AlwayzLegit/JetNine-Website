"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { track } from "@/lib/analytics";

/**
 * A plain "Request a quote" link to /quote/mission that still records
 * `quote_launcher_submitted` with its page context, for pages where the
 * light design replaced a QuoteLauncher with a button (the charter hub).
 */
export function TrackedQuoteLink({
  context,
  className,
  children,
}: {
  context: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href="/quote/mission" className={className} onClick={() => track("quote_launcher_submitted", { context })}>
      {children}
    </Link>
  );
}
