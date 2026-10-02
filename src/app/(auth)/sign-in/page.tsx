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
      <div className="card card-pad mx-auto max-w-[460px] sm:p-10">
        <p className="eyebrow">Sign in</p>
        <h1 className="title-app text-bone">One link, in your inbox.</h1>
        <p className="lead mt-4">
          We don&rsquo;t do passwords. Enter your email, click the link we send, and you&rsquo;re
          in. The link works once — if it expires, just request another.
        </p>
        <p className="mt-3 text-[15px] leading-[1.55] text-steel">
          Accounts are set up by dispatch when you fly with us. New to JetNine?{" "}
          <Link href="/quote/mission" className="text-link">
            Start with a quote
          </Link>
          .
        </p>
        <div className="mt-8">
          <SignInForm next={next} initialError={errorWords(error)} />
        </div>
        <p className="mt-8 border-t border-line pt-6 text-[14px] leading-[1.55] text-steel">
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
    </section>
  );
}
