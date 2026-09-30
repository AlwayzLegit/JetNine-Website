import Link from "next/link";
import { PageHero } from "@/components/page-hero";

// Plain-ink hero plus one centred card — the frame shared by the
// watchlist confirm and unsubscribe pages.
export function TokenPageShell({
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
      <PageHero eyebrow="Empty legs · watchlist" title={title} lead={lead} />
      <section className="container-jn pb-[128px] pt-4 max-md:pb-20">
        <div className="mx-auto max-w-[720px]">{children}</div>
      </section>
    </>
  );
}

// A link that can no longer do anything: used, expired, or not ours.
export function DeadTokenCard({ heading, body }: { heading: string; body: string }) {
  return (
    <div className="card p-10 text-center max-md:p-6">
      <h2 className="title-card">{heading}</h2>
      <p className="mx-auto mt-3 max-w-[52ch] text-bone-2">{body}</p>
      <Link href="/empty-legs" className="btn btn-primary btn-lg mt-8">
        Back to the board <span className="arrow" aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
