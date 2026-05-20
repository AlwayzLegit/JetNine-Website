import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNav />
      {/* No top padding here — pages with full-bleed heroes overlay the nav.
          Other pages should add their own pt-20 spacing. */}
      <main className="min-h-screen">{children}</main>
      <SiteFooter />
    </>
  );
}
