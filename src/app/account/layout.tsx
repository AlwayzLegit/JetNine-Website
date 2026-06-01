import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { SkipLink } from "@/components/skip-link";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireUser("/account");
  return (
    <>
      <SkipLink />
      <SiteNav />
      <main id="main-content" className="min-h-screen pt-32">{children}</main>
      <SiteFooter />
    </>
  );
}
