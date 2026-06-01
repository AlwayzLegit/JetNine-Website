import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { SkipLink } from "@/components/skip-link";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SkipLink />
      <SiteNav />
      {/* No top padding here — pages with full-bleed heroes overlay the nav.
          Other pages should add their own pt-20 spacing. */}
      <main id="main-content" className="min-h-screen">{children}</main>
      <SiteFooter />
    </>
  );
}
