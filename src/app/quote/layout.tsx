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
    description: `Route, timing, and aircraft preferences in four short steps — a senior dispatcher returns three to five vetted aircraft with all-in pricing ${when} during operating hours.`,
    alternates: { canonical: "/quote/mission" },
  };
}

// Quote flow chrome (Light — Quote.dc): its own white header (not the
// marketing SiteNav), then one centred 760px column holding the slim
// 4-step progress bar and the step's panel — the prototype's request
// dialog, set in the page instead of over it. Each step renders its own
// <QuotePanel>; the mission step adds the static "How quoting works"
// copy under it.
export default async function QuoteLayout({ children }: { children: React.ReactNode }) {
  const replyMinutes = await getReplyPromiseMinutes();
  return (
    <ReplyPromiseProvider minutes={replyMinutes}>
      <SkipLink />
      <QuoteNav />
      <main id="main-content" className="container-jn min-h-screen pb-16 pt-8 md:pb-24 md:pt-10">
        <div className="mx-auto w-full max-w-[760px]">
          <QuoteStepper />
          {children}
        </div>
      </main>
    </ReplyPromiseProvider>
  );
}
