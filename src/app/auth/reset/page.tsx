import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { SkipLink } from "@/components/skip-link";
import { SetPasswordForm } from "@/components/auth/set-password-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Set your password",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Where the reset email lands, and where an invited member sets a first
 * password. The link itself carries a `code` (or `token_hash`); the
 * middleware forwards that to /auth/callback, which signs the member in
 * and returns here with the session cookie set. No session means the link
 * expired or was already used.
 */
export default async function AuthResetPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <SkipLink />
      <SiteNav />
      <main id="main-content" className="min-h-screen pb-24 pt-16 md:pt-24">
        <section className="container-jn">
          <div className="mx-auto max-w-[520px]">
            <p className="eyebrow">Password</p>
            {user ? (
              <>
                <h1 className="font-serif text-[clamp(34px,6vw,48px)] font-normal leading-[1.05] text-bone">
                  Set your password.
                </h1>
                <p className="mt-4 max-w-[46ch] text-[17px] leading-[1.55] text-bone-2">
                  Signed in as <strong className="text-bone">{user.email}</strong>. Choose a password
                  and you&rsquo;re through to your account.
                </p>
                <div className="mt-7 border border-line bg-surface px-6 py-7 sm:px-8">
                  <SetPasswordForm idPrefix="reset" submitLabel="Save and continue" redirectTo="/account" />
                </div>
              </>
            ) : (
              <>
                <h1 className="font-serif text-[clamp(34px,6vw,48px)] font-normal leading-[1.05] text-bone">
                  That link has expired.
                </h1>
                <p className="mt-4 max-w-[46ch] text-[17px] leading-[1.55] text-bone-2">
                  Reset links work once and for a short while. Request a fresh one and open it on
                  this device.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link href="/sign-in/reset" className="btn btn-primary">
                    Request a new link <span className="arrow">→</span>
                  </Link>
                  <Link href="/sign-in" className="btn btn-secondary">
                    Back to sign in
                  </Link>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
