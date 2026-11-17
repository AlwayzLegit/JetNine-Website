import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { SkipLink } from "@/components/skip-link";
import { peekToken } from "@/lib/auth-tokens";
import { spendEmailLink } from "./actions";

// The page that receives a one-time token in its address. noindex, and no
// referrer is sent from it, so the token cannot leak to another site.
export const metadata: Metadata = {
  title: "Continue to JetNine",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ t?: string; p?: string; next?: string; expired?: string }>;
};

/**
 * Where an emailed link lands. GET only checks the token, it never spends it
 * and sets no cookie: mail scanners fetch links, and a link they open must
 * still work for the person. The token is spent by the POST behind the
 * button (spendEmailLink).
 */
export default async function AuthLinkPage({ searchParams }: Props) {
  const { t, p, next, expired } = await searchParams;
  const usable = !expired && (await peekToken(t, p));
  const isSignin = p === "signin";

  return (
    <>
      <SkipLink />
      <SiteNav />
      <main id="main-content" className="min-h-screen pb-24 pt-16 md:pt-24">
        <section className="container-jn">
          <div className="mx-auto max-w-[520px]">
            {usable ? (
              <>
                <p className="eyebrow">{isSignin ? "Sign in" : "Password"}</p>
                <h1 className="font-serif text-[clamp(34px,6vw,48px)] font-normal leading-[1.05] text-bone">
                  {isSignin ? "One step to sign in." : "One step to set your password."}
                </h1>
                <p className="mt-4 max-w-[46ch] text-[17px] leading-[1.55] text-bone-2">
                  {isSignin
                    ? "Press the button to sign in on this device. The link works once."
                    : "Press the button, then choose your password. The link works once."}
                </p>
                <form action={spendEmailLink} className="mt-7">
                  <input type="hidden" name="t" value={t} />
                  <input type="hidden" name="p" value={p} />
                  <input type="hidden" name="next" value={next ?? ""} />
                  <button type="submit" className="btn btn-primary">
                    {isSignin ? "Sign in to JetNine" : "Set your password"} <span className="arrow">→</span>
                  </button>
                </form>
              </>
            ) : (
              <>
                <p className="eyebrow">Link</p>
                <h1 className="font-serif text-[clamp(34px,6vw,48px)] font-normal leading-[1.05] text-bone">
                  That link has expired.
                </h1>
                <p className="mt-4 max-w-[46ch] text-[17px] leading-[1.55] text-bone-2">
                  Emailed links work once and for a short while. Request a fresh one and open it on
                  this device.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link href="/sign-in" className="btn btn-primary">
                    Back to sign in <span className="arrow">→</span>
                  </Link>
                  <Link href="/sign-in/reset" className="btn btn-secondary">
                    Reset your password
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
