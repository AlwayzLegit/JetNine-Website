import type { Metadata } from "next";
import { getReplyPromiseMinutes } from "@/lib/desk-settings";
import { pageMetadata } from "@/lib/page-meta";
import { QuoteNav } from "@/components/quote/quote-nav";
import { ReplyPromiseProvider } from "@/components/quote/reply-promise";
import { QuoteStepper } from "@/components/quote/stepper";
import { SkipLink } from "@/components/skip-link";

// The client-side wizard inherits page-specific search and social metadata.
// Only its entry step is in the sitemap; later steps remain excluded by robots.txt.
// Reply timing in the visible flow still follows the desk setting.
export const revalidate = 300;

export const metadata: Metadata = pageMetadata({
  title: "Request a Private Jet Charter Quote",
  description: "Request a private jet charter quote for a one-way, round-trip or multi-city journey. Share your route, dates, passenger count and aircraft preferences.",
  path: "/quote/mission",
});

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
