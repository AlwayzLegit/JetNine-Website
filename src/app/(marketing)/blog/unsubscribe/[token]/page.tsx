import type { Metadata } from "next";
import { BlogUnsubscribeCard } from "@/components/blog/unsubscribe-card";
import { BlogTokenPageShell } from "@/components/blog/token-page-shell";

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
    <BlogTokenPageShell
      title="Stop the digest."
      lead="This only stops the emails. The blog stays open to you."
    >
      <BlogUnsubscribeCard token={token} />
    </BlogTokenPageShell>
  );
}
