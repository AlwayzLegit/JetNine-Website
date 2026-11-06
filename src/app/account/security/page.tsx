import { getCurrentUser, requireUser } from "@/lib/auth";
import { Eyebrow, PANEL, PageHead } from "@/components/account/panel";
import { SetPasswordForm } from "@/components/auth/set-password-form";

export const dynamic = "force-dynamic";

export default async function AccountSecurityPage() {
  await requireUser("/account/security");
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <>
      <PageHead
        title="Security"
        sub="How you sign in. A password works alongside the emailed link — set one here and either gets you in."
      />

      <div className="mt-[22px] flex flex-col gap-4">
        <section className={`${PANEL} px-6 py-[22px] max-md:px-5`}>
          <Eyebrow>Change password</Eyebrow>
          <p className="mt-2 max-w-[60ch] text-[15px] leading-[1.55] text-steel">
            For <strong className="text-bone">{user.email}</strong>. No password yet? This sets your first one.
          </p>
          <div className="mt-5 max-w-[420px]">
            <SetPasswordForm
              idPrefix="acct"
              submitLabel="Save password"
              savedMessage="Saved. Use it next time you sign in."
            />
          </div>
        </section>

        <section className={`${PANEL} px-6 py-[22px] max-md:px-5`}>
          <Eyebrow>Sign-in link</Eyebrow>
          <p className="mt-2 max-w-[60ch] text-[15px] leading-[1.55] text-steel">
            You can always sign in without a password: choose &ldquo;email me a sign-in link&rdquo; on
            the sign-in page and we send a one-time link to {user.email}.
          </p>
        </section>
      </div>
    </>
  );
}
