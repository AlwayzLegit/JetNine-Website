import Link from "next/link";
import { Breadcrumb } from "@/components/light/breadcrumb";

// Paper intro (journal grammar) plus one centred white card — the frame
// shared by the digest confirm and unsubscribe pages.
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
      <section className="container-jn pb-24 pt-[18px] max-md:pb-16">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Journal", href: "/blog" }, { label: "Friday digest" }]} className="font-serif" />
        <div className="mx-auto mt-10 max-w-[720px] max-md:mt-7">
          <p className="eyebrow !mb-0">The JetNine journal · Friday digest</p>
          <h1 className="mt-2 font-serif text-[clamp(34px,8vw,48px)] font-normal leading-[1.04] tracking-[-0.015em]">{title}</h1>
          {lead ? <p className="mt-3 max-w-[56ch] font-serif text-[19px] leading-[1.4] text-bone-2">{lead}</p> : null}
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </>
  );
}

export function BlogDeadTokenCard({ heading, body }: { heading: string; body: string }) {
  return (
    <div className="border border-line bg-white p-10 text-center max-md:p-6">
      <h2 className="font-serif text-[28px] font-normal leading-[1.15]">{heading}</h2>
      <p className="mx-auto mt-3 max-w-[52ch] text-bone-2">{body}</p>
      <Link href="/blog" className="btn btn-primary btn-lg mt-8">
        Back to the journal <span className="arrow" aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
