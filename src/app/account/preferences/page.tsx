import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  companions,
  memberLanes,
  memberPreferences,
} from "@/db/schema/member-prefs";
import { emptyLegWatchlists } from "@/db/schema/empty-legs";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { getMemberByUserId } from "@/lib/member";
import { PreferencesForm } from "./preferences-form";
import { CompanionsSection } from "./companions-section";
import { LanesSection } from "./lanes-section";
import { WatchlistsSection } from "./watchlists-section";

export const dynamic = "force-dynamic";

export default async function AccountPreferencesPage() {
  await requireUser("/account/preferences");
  const user = await getCurrentUser();
  if (!user) return null;

  const member = await getMemberByUserId(user.id);

  if (!member) {
    return (
      <>
        <h1 className="title-app text-bone">Preferences</h1>
        <p className="mt-2.5 max-w-[60ch] text-[17px] text-bone-2">
          Dispatch sets up your profile when you book your first flight. Until then there&rsquo;s
          nothing to customise.
        </p>
        <Link href="/quote" className="btn btn-primary mt-8">
          Request a quote <span aria-hidden="true">→</span>
        </Link>
      </>
    );
  }

  const [existing, companionRows, laneRows, watchlistRows] = await Promise.all([
    db
      .select()
      .from(memberPreferences)
      .where(eq(memberPreferences.memberId, member.id))
      .then((rows) => rows[0]),
    db
      .select()
      .from(companions)
      .where(eq(companions.memberId, member.id))
      .orderBy(asc(companions.createdAt)),
    db
      .select()
      .from(memberLanes)
      .where(eq(memberLanes.memberId, member.id))
      .orderBy(asc(memberLanes.createdAt)),
    db
      .select()
      .from(emptyLegWatchlists)
      .where(eq(emptyLegWatchlists.memberId, member.id))
      .orderBy(desc(emptyLegWatchlists.createdAt)),
  ]);

  return (
    <>
      <h1 className="title-app text-bone">Preferences</h1>
      <p className="mt-2.5 max-w-[64ch] text-[17px] text-bone-2">
        What carries forward to every flight — cabin, catering, ground, and the people and routes
        that travel with you. Each new quote starts from these; change anything on the quote when
        a trip needs something different.
      </p>

      <div className="mt-8 flex flex-col gap-4">
        <PreferencesForm initial={existing ?? null} />
        <CompanionsSection initial={companionRows} />
        <LanesSection initial={laneRows} />
        <WatchlistsSection initial={watchlistRows} />
      </div>
    </>
  );
}
