import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { SkipLink } from "@/components/skip-link";
import { AccountRail } from "@/components/account/account-rail";
import { requireUser } from "@/lib/auth";
import { signOut } from "@/app/(auth)/sign-in/actions";

export const dynamic = "force-dynamic";

// Member account (Light - Account): public header, a 220px sticky left
// rail (sections, dispatcher contact, sign out) beside the content. The
// two wrap with flex like the prototype, so on phones the rail stacks
// above the content as a compact header with section chips.
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/account");
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email.split("@")[0];
  const staff = ["dispatcher", "admin", "superadmin"].includes(user.role);
  return (
    <>
      <SkipLink />
      <SiteNav />
      <div className="mx-auto flex min-h-screen max-w-[1240px] flex-wrap items-start gap-7 px-[clamp(16px,4vw,32px)] pb-16 pt-[22px] lg:flex-nowrap">
        <div className="min-w-0 max-w-full flex-[1_1_220px] self-stretch lg:max-w-[220px]">
          <AccountRail name={name} email={user.email} signOutAction={signOut} staff={staff} />
        </div>
        <main id="main-content" className="min-w-0 flex-[999_1_420px]">
          {children}
        </main>
      </div>
      <SiteFooter />
    </>
  );
}
