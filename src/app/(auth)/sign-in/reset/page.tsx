import type { Metadata } from "next";
import Link from "next/link";
import { ResetRequestForm } from "./reset-request-form";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Get a link to set a new password for your JetNine account.",
  robots: { index: false },
};

export default function ResetRequestPage() {
  return (
    <section className="container-jn">
      <div className="mx-auto max-w-[520px]">
        <p className="eyebrow">Reset password</p>
        <h1 className="font-serif text-[clamp(34px,6vw,48px)] font-normal leading-[1.05] text-bone">
          Forgot it? No problem.
        </h1>
        <p className="mt-4 max-w-[46ch] text-[17px] leading-[1.55] text-bone-2">
          Enter your email and we&rsquo;ll send a link to set a new password. The link works once.
        </p>

        <div className="mt-7 border border-line bg-surface px-6 py-7 sm:px-8">
          <ResetRequestForm />
          <p className="mt-6 border-t border-line pt-5 text-[13px] leading-[1.55] text-steel">
            Remembered it?{" "}
            <Link href="/sign-in" className="text-link">
              Back to sign in
            </Link>
            . Trouble? Email{" "}
            <a href="mailto:dispatch@jetnine.com" className="text-link">
              dispatch@jetnine.com
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
