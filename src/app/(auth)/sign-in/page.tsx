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

export default async function SignInPage({ searchParams }: Props) {
  const { next, error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(next ?? "/account");

  return (
    <section className="container-jn">
      <div className="mx-auto max-w-[440px] rounded-[4px] border border-ink-3 bg-ink-2 p-10">
        <p className="caption mb-4">— Sign in</p>
        <h1 className="font-serif text-[36px] font-light leading-tight tracking-tight text-bone">
          One link, in your inbox.
        </h1>
        <p className="mt-4 text-[14px] leading-[1.55] text-bone-2">
          We don&rsquo;t do passwords. Enter your email, click the link we send, you&rsquo;re in.
          The link works once and expires after 10 minutes.
        </p>
        <div className="mt-8">
          <SignInForm next={next} initialError={error} />
        </div>
        <p className="mt-8 border-t border-ink-3 pt-6 font-mono text-[10px] uppercase tracking-[0.12em] text-steel">
          — Trouble signing in? Email{" "}
          <a
            href="mailto:dispatch@jetnine.com"
            className="text-clearance underline underline-offset-2"
          >
            dispatch@jetnine.com
          </a>{" "}
          or call{" "}
          <Link href="/contact" className="text-clearance underline underline-offset-2">
            dispatch
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
