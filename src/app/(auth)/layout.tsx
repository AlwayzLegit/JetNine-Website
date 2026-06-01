import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { SkipLink } from "@/components/skip-link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SkipLink />
      <SiteNav />
      <main id="main-content" className="min-h-screen pt-32 pb-24">{children}</main>
      <SiteFooter />
    </>
  );
}
