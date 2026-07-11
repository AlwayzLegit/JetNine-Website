import type { Metadata } from "next";
import { QuoteNav } from "@/components/quote/quote-nav";
import { QuoteStepper } from "@/components/quote/stepper";
import { SkipLink } from "@/components/skip-link";

// The wizard steps are client components and can't export metadata, so
// title/description/canonical are set here. `/quote/mission` is the one
// indexable step (it's in the sitemap; the others are robots-disallowed).
// Without an explicit title + description here the page inherited the root
// layout's defaults verbatim — Semrush flagged / and /quote/mission as
// duplicate-title and duplicate-meta-description pairs.
export const metadata: Metadata = {
  title: "Request a quote",
  description:
    "Route, timing, and aircraft preferences in four short steps — a senior dispatcher returns three to five vetted airframes with all-in pricing within 30 minutes during operating hours.",
  alternates: { canonical: "/quote/mission" },
};

export default function QuoteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SkipLink />
      <QuoteNav />
      <QuoteStepper />
      <main id="main-content" className="min-h-screen pb-32">{children}</main>
    </>
  );
}
