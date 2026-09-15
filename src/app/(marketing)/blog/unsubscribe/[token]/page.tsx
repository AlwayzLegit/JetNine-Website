import type { Metadata } from "next";
import { Reveal } from "@/components/reveal";
import { BlogUnsubscribeCard } from "../unsubscribe-card";

// Reading only. The unsubscribe itself is a POST from the card, so a
// scanner walking the email cannot unsubscribe the reader — the header
// route (/api/email/blog-unsubscribe) is the one that acts on a bare
// POST, which is what RFC 8058 asks for.
//
// No token lookup here at all: the card POSTs regardless, the action is
// idempotent, and rendering the same card for real and fake tokens means
// a probe learns nothing.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stop the weekly digest · JetNine",
  robots: { index: false, follow: false },
};

export default async function BlogUnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <>
      <header className="border-b border-ink-3 bg-ink pt-[200px] pb-16 max-md:pt-[140px] max-md:pb-12">
        <div className="container-jn">
          <Reveal className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-bone-2">
            <span className="block h-px w-8 bg-clearance" />
            Blog · weekly digest
          </Reveal>
        </div>
      </header>
      <section className="py-20 max-md:py-14">
        <div className="container-jn">
          <div className="mx-auto max-w-[720px]">
            <BlogUnsubscribeCard token={token} />
          </div>
        </div>
      </section>
    </>
  );
}
