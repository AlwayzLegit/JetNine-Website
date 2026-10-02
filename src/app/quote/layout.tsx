import type { Metadata } from "next";
import { getReplyPromiseMinutes } from "@/lib/desk-settings";
import { replyPromiseWords } from "@/lib/desk-status";
import { QuoteNav } from "@/components/quote/quote-nav";
import { ReplyPromiseProvider } from "@/components/quote/reply-promise";
import { QuoteStepper } from "@/components/quote/stepper";
import { SkipLink } from "@/components/skip-link";

// The wizard steps are client components and can't export metadata, so
// title/description/canonical are set here. `/quote/mission` is the one
// indexable step (it's in the sitemap; the others are robots-disallowed).
// Without an explicit title + description here the page inherited the root
// layout's defaults verbatim — Semrush flagged / and /quote/mission as
// duplicate-title and duplicate-meta-description pairs.
//
// The reply time ("within 30 minutes") follows the desk setting
// (Settings › Notifications). The steps stay statically rendered and are
// refreshed every five minutes, so a change shows up here within that.
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const when = replyPromiseWords(await getReplyPromiseMinutes());
  return {
    title: "Request a Private Jet Charter Quote",
    description: `Route, timing, and aircraft preferences in four short steps — a senior dispatcher returns three to five vetted aircraft with all-in pricing ${when}.`,
    alternates: { canonical: "/quote/mission" },
  };
}

// Quote flow chrome from the simplification handoff: its own 72px header
// (not the marketing SiteNav), the 4-step bar, then the two-column page
// grid — `minmax(0,1fr) 340px`, 40px gap. Each step renders its form as
// the first grid child and `<QuoteSidebar step={n} />` as the second, so
// the step decides which rows the "Your trip so far" card shows.
//
// Bottom padding on phones clears the pinned StepFooter (52px button +
// 24px of padding + the home-indicator inset).
export default async function QuoteLayout({ children }: { children: React.ReactNode }) {
  const replyMinutes = await getReplyPromiseMinutes();
  return (
    <ReplyPromiseProvider minutes={replyMinutes}>
      <SkipLink />
      <QuoteNav />
      <QuoteStepper />
      <main
        id="main-content"
        className="container-jn grid min-h-screen grid-cols-1 items-start gap-10 py-12 max-md:pb-[calc(112px+env(safe-area-inset-bottom))] lg:grid-cols-[minmax(0,1fr)_340px]"
      >
        {children}
      </main>
    </ReplyPromiseProvider>
  );
}
