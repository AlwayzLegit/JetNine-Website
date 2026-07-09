import type { Metadata } from "next";
import { QuoteNav } from "@/components/quote/quote-nav";
import { QuoteStepper } from "@/components/quote/stepper";
import { SkipLink } from "@/components/skip-link";

// The wizard steps are client components and can't export metadata, so the
// canonical is set here. `/quote/mission` is the one indexable step (it's in
// the sitemap; the others are robots-disallowed), and without this it
// inherited the root layout's `canonical: "/"` — which made it a
// non-self-canonical URL in the sitemap (Semrush "incorrect page in sitemap").
export const metadata: Metadata = {
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
