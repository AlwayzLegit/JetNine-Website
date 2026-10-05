import Link from "next/link";
import { Breadcrumb } from "@/components/light/breadcrumb";

// Paper intro (breadcrumb, serif title) plus one centred white box — the
// frame shared by the watchlist confirm and unsubscribe pages, in the
// Light - Empty legs grammar.
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
    <section className="container-jn pb-[96px] pt-4 max-md:pb-16">
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Empty legs", href: "/empty-legs" },
          { label: "Watchlist" },
        ]}
      />
      <div className="mx-auto mt-10 max-w-[720px] max-md:mt-6">
        <p className="eyebrow mb-3">Empty legs · watchlist</p>
        <h1 className="font-serif text-[clamp(34px,9vw,52px)] font-normal leading-[1.04] tracking-[-0.01em]">
          {title}
        </h1>
        {lead ? <p className="mt-3 max-w-[56ch] font-serif text-[20px] leading-[1.35] text-steel">{lead}</p> : null}
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

export const TOKEN_CARD = "border border-line bg-white p-8 text-center max-md:p-5";
export const TOKEN_BTN =
  "btn border-gold bg-gold px-6 font-bold text-white hover:border-gold hover:bg-gold hover:text-white hover:opacity-90";

// A link that can no longer do anything: used, expired, or not ours.
export function DeadTokenCard({ heading, body }: { heading: string; body: string }) {
  return (
    <div className={TOKEN_CARD}>
      <h2 className="title-card-sm">{heading}</h2>
      <p className="mx-auto mt-3 max-w-[52ch] text-[15px] text-steel">{body}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
        <Link href="/empty-legs" className={TOKEN_BTN}>
          Back to the board <span aria-hidden="true">→</span>
        </Link>
        <Link href="/empty-legs#watchlist" className="text-link text-[14px]">
          Set up a watchlist
        </Link>
      </div>
    </div>
  );
}
