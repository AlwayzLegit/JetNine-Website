import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { SkipLink } from "@/components/skip-link";
import { AccountRail, AccountTabBar } from "@/components/account/account-rail";
import { requireUser } from "@/lib/auth";
import { signOut } from "@/app/(auth)/sign-in/actions";

export const dynamic = "force-dynamic";

// Member account from the handoff: public header, 200px sticky left rail
// (seven sections, primary quote button, sign out) and the page content.
// Phones get a pinned four-tab bar instead of the rail.
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/account");
  const name = user.firstName || user.email.split("@")[0];
  const staff = ["dispatcher", "admin", "superadmin"].includes(user.role);
  return (
    <>
      <SkipLink />
      <SiteNav />
      <main
        id="main-content"
        className="container-jn grid min-h-screen items-start gap-10 py-12 max-lg:pb-28 lg:grid-cols-[200px_minmax(0,1fr)]"
      >
        <AccountRail name={name} email={user.email} signOutAction={signOut} staff={staff} />
        <div className="min-w-0">{children}</div>
      </main>
      <AccountTabBar signOutAction={signOut} />
      <SiteFooter />
    </>
  );
}
