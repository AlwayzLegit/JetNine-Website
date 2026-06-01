import { QuoteNav } from "@/components/quote/quote-nav";
import { QuoteStepper } from "@/components/quote/stepper";
import { SkipLink } from "@/components/skip-link";

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
