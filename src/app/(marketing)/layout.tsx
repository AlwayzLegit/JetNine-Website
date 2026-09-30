import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { SkipLink } from "@/components/skip-link";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SkipLink />
      <SiteNav />
      {/* The header is sticky and in normal flow, so pages start directly
          beneath it — no top padding needed here or on the pages. */}
      <main id="main-content" className="min-h-screen">{children}</main>
      <SiteFooter />
    </>
  );
}
