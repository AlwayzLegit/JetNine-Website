import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { memberPreferences } from "@/db/schema/member-prefs";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { getMemberByUserId } from "@/lib/member";
import { PreferencesForm } from "./preferences-form";

export const dynamic = "force-dynamic";

export default async function AccountPreferencesPage() {
  await requireUser("/account/preferences");
  const user = await getCurrentUser();
  if (!user) return null;

  const member = await getMemberByUserId(user.id);

  if (!member) {
    return (
      <section className="container-jn py-12">
        <p className="caption mb-4">— Account · preferences</p>
        <h1 className="font-serif text-[40px] font-light leading-tight tracking-tight text-bone">
          No member profile yet.
        </h1>
        <p className="mt-4 max-w-[60ch] text-[16px] leading-[1.55] text-bone-2">
          Dispatch creates one when you book your first flight. Until then there&rsquo;s nothing to
          customize. Start a quote at{" "}
          <Link href="/quote" className="text-clearance">/quote</Link>.
        </p>
      </section>
    );
  }

  const [existing] = await db
    .select()
    .from(memberPreferences)
    .where(eq(memberPreferences.memberId, member.id));

  return (
    <section className="container-jn py-12">
      <header className="mb-10 border-b border-ink-3 pb-6">
        <p className="caption mb-3">— Account · preferences</p>
        <h1 className="font-serif text-[44px] font-light leading-tight tracking-tight text-bone">
          What carries forward, every flight.
        </h1>
        <p className="mt-4 max-w-[64ch] text-[15px] leading-[1.55] text-bone-2">
          Cabin defaults, catering, ground, comms, privacy. Pre-fills every new quote — override on
          the wizard when a trip needs something different.
        </p>
      </header>
      <PreferencesForm initial={existing ?? null} />
    </section>
  );
}
