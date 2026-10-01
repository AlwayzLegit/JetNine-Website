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
  title: "Request a Private Jet Charter Quote",
  description:
    "Route, timing, and aircraft preferences in four short steps — a senior dispatcher returns three to five vetted airframes with all-in pricing within 30 minutes during operating hours.",
  alternates: { canonical: "/quote/mission" },
};

// Quote flow chrome from the simplification handoff: its own 72px header
// (not the marketing SiteNav), the 4-step bar, then the two-column page
// grid — `minmax(0,1fr) 340px`, 40px gap. Each step renders its form as
// the first grid child and `<QuoteSidebar step={n} />` as the second, so
// the step decides which rows the "Your trip so far" card shows.
//
// Bottom padding on phones clears the pinned StepFooter (52px button +
// 24px of padding + the home-indicator inset).
export default function QuoteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SkipLink />
      <QuoteNav />
      <QuoteStepper />
      <main
        id="main-content"
        className="container-jn grid min-h-screen grid-cols-1 items-start gap-10 py-12 max-md:pb-[calc(112px+env(safe-area-inset-bottom))] lg:grid-cols-[minmax(0,1fr)_340px]"
      >
        {children}
      </main>
    </>
  );
}
