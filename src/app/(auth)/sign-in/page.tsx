import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your JetNine member account or dispatch desk.",
};

type Props = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

// The auth callback passes either Supabase's own message or this code;
// codes are never shown to a person as-is.
function errorWords(error?: string): string | undefined {
  if (!error) return undefined;
  if (error === "missing_code") return "That sign-in link was incomplete. Request a new one below.";
  return error;
}

export default async function SignInPage({ searchParams }: Props) {
  const { next, error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(next ?? "/account");

  return (
    <section className="container-jn">
      <div className="mx-auto grid max-w-[1000px] grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] items-start gap-x-14 gap-y-8">
        <div className="min-w-0 pt-2">
          <p className="eyebrow">Sign in</p>
          <h1 className="font-serif text-[clamp(34px,6vw,48px)] font-normal leading-[1.05] text-bone">
            One link, in your inbox.
          </h1>
          <p className="mt-4 max-w-[46ch] text-[17px] leading-[1.55] text-bone-2">
            We don&rsquo;t do passwords. Enter your email, click the link we send, and you&rsquo;re
            in. The link works once — if it expires, just request another.
          </p>
          <p className="mt-3 max-w-[46ch] text-[15px] leading-[1.55] text-steel">
            Accounts are set up by dispatch when you fly with us. New to JetNine?{" "}
            <Link href="/quote/mission" className="text-link">
              Start with a quote
            </Link>
            .
          </p>
          <ul className="mt-6 flex flex-col gap-2 border-t border-line pt-5 text-[14px] text-bone">
            <li className="flex gap-2.5">
              <span className="text-gold" aria-hidden="true">●</span>Your trips, with the time, the aircraft and where to go
            </li>
            <li className="flex gap-2.5">
              <span className="text-gold" aria-hidden="true">●</span>Quotes you&rsquo;ve sent and where each one stands
            </li>
            <li className="flex gap-2.5">
              <span className="text-gold" aria-hidden="true">●</span>Invoices, membership balance and preferences
            </li>
          </ul>
        </div>

        <div className="border border-line bg-surface px-6 py-7 sm:px-8">
          <p className="text-[12px] font-bold uppercase tracking-[.2em] text-gold">Member account</p>
          <h2 className="mt-2 font-serif text-[24px] font-normal leading-[1.15] text-bone">Email me a sign-in link</h2>
          <div className="mt-5">
            <SignInForm next={next} initialError={errorWords(error)} />
          </div>
          <p className="mt-6 border-t border-line pt-5 text-[13px] leading-[1.55] text-steel">
            Trouble signing in? Email{" "}
            <a href="mailto:dispatch@jetnine.com" className="text-link">
              dispatch@jetnine.com
            </a>{" "}
            or{" "}
            <Link href="/contact" className="text-link">
              contact dispatch
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
