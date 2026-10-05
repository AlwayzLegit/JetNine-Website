import Link from "next/link";
import type { Metadata } from "next";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { IconDisc, type FaqIconName } from "@/components/faq/faq-icons";
import { SITE } from "@/lib/constants";

// Tell Google not to index 404 pages. Without this, the root layout's
// robots: { index: true } cascades and Search Console eventually
// flags every 404 hit as an indexable page (then de-indexes them with
// a soft-404 warning). Explicit noindex skips that cycle entirely.
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

const PLACES: { href: string; title: string; sub: string; icon: FaqIconName }[] = [
  { href: "/aircraft", title: "Aircraft", sub: "Cabin, range and baggage", icon: "plane" },
  { href: "/routes", title: "Routes", sub: "Popular city pairs", icon: "pin" },
  { href: "/cost-calculator", title: "Cost calculator", sub: "Estimate your trip", icon: "calc" },
  { href: "/faq", title: "FAQ", sub: "Answers before you fly", icon: "question" },
];

// The root 404 renders outside the marketing layout, so it brings the
// site header and footer itself. Light paper intro + four way-out cards.
export default function NotFound() {
  return (
    <>
      <SiteNav />
      <main id="main-content" className="container-jn min-h-[60vh] pb-16 pt-[18px]">
        <p className="text-[12px] text-steel">Error 404</p>
        <p className="eyebrow mb-[6px] mt-[14px]">Page not found</p>
        <h1 className="font-serif text-[clamp(34px,9vw,54px)] font-normal leading-[1.04] tracking-[-.01em]">
          Off the flight plan.
        </h1>
        <p className="mt-[10px] max-w-[56ch] font-serif text-[20px] leading-[1.4] max-sm:text-[18px]">
          We couldn&rsquo;t find that page. It may have been moved, renamed, or never existed. Head back to the
          homepage or start a quote — dispatch will route you from there.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/" className="btn btn-primary">
            Back to home <span aria-hidden="true">→</span>
          </Link>
          <Link href="/quote/mission" className="btn btn-secondary">
            Request a quote <span aria-hidden="true">↗</span>
          </Link>
        </div>

        <h2 className="mt-12 font-serif text-[32px] font-normal leading-[1.1] max-sm:text-[28px]">Or pick up from here.</h2>
        <div className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
          {PLACES.map((p) => (
            <Link key={p.href} href={p.href} className="group grid grid-cols-[48px_minmax(0,1fr)] items-center gap-3 border border-line bg-white p-4 hover:border-gold">
              <IconDisc name={p.icon} />
              <span>
                <span className="block font-serif text-[18px] group-hover:text-gold">{p.title}</span>
                <span className="block text-[13px] text-steel">{p.sub}</span>
              </span>
            </Link>
          ))}
        </div>
        <p className="mt-6 text-[14px] text-steel">
          Need a person?{" "}
          <a href={`tel:${SITE.dispatchPhoneE164}`} className="text-link">
            Call dispatch · {SITE.dispatchPhone}
          </a>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
