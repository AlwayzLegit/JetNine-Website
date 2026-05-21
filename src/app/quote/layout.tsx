import { QuoteNav } from "@/components/quote/quote-nav";
import { QuoteStepper } from "@/components/quote/stepper";

export default function QuoteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <QuoteNav />
      <QuoteStepper />
      <main className="min-h-screen pb-32">{children}</main>
    </>
  );
}
