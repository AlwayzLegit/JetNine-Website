import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { SkipLink } from "@/components/skip-link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SkipLink />
      <SiteNav />
      <main id="main-content" className="min-h-screen pb-24 pt-16 md:pt-24">{children}</main>
      <SiteFooter />
    </>
  );
}
