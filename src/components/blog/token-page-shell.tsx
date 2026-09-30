import Link from "next/link";
import { PageHero } from "@/components/page-hero";

// Plain-ink hero plus one centred card — the frame shared by the digest
// confirm and unsubscribe pages.
export function BlogTokenPageShell({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <PageHero eyebrow="Blog · weekly digest" title={title} lead={lead} />
      <section className="container-jn pb-[128px] pt-4 max-md:pb-20">
        <div className="mx-auto max-w-[720px]">{children}</div>
      </section>
    </>
  );
}

export function BlogDeadTokenCard({ heading, body }: { heading: string; body: string }) {
  return (
    <div className="card p-10 text-center max-md:p-6">
      <h2 className="title-card">{heading}</h2>
      <p className="mx-auto mt-3 max-w-[52ch] text-bone-2">{body}</p>
      <Link href="/blog" className="btn btn-primary btn-lg mt-8">
        Back to the blog <span className="arrow" aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
