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
    <section className="container-jn py-12">
      <header className="mb-10 border-b border-ink-3 pb-6">
        <p className="caption mb-3">— Account · preferences</p>
        <h1 className="font-serif text-[44px] font-light leading-tight tracking-tight text-bone">
          What carries forward, every flight.
        </h1>
        <p className="mt-4 max-w-[64ch] text-[15px] leading-[1.55] text-bone-2">
          Cabin defaults, catering, ground, comms, privacy — plus the people and the routes that
          carry forward with you. Pre-fills every new quote; override on the wizard when a trip
          needs something different.
        </p>
      </header>
      <PreferencesForm initial={existing ?? null} />

      <div className="mt-16 grid gap-6 lg:grid-cols-[200px_1fr] lg:gap-10">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-clearance">
            — 07
          </span>
          <h2 className="mt-3 font-serif text-[22px] font-normal leading-[1.2] tracking-tight text-bone">
            Companions
          </h2>
          <p className="mt-3 text-[13px] leading-[1.55] text-bone-2">
            Spouses, family, assistants, pets — the people who fly with you. Stored encrypted, used
            to pre-fill APIS manifests and itinerary CCs.
          </p>
        </div>
        <CompanionsSection initial={companionRows} />
      </div>

      <div className="mt-16 grid gap-6 lg:grid-cols-[200px_1fr] lg:gap-10">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-clearance">
            — 08
          </span>
          <h2 className="mt-3 font-serif text-[22px] font-normal leading-[1.2] tracking-tight text-bone">
            Frequent lanes
          </h2>
          <p className="mt-3 text-[13px] leading-[1.55] text-bone-2">
            Tell dispatch the routes you fly most. Powers empty-leg matching, pre-positioning, and
            the quote wizard&rsquo;s {`"`}fly this again{`"`} shortcut.
          </p>
        </div>
        <LanesSection initial={laneRows} />
      </div>

      <div className="mt-16 grid gap-6 lg:grid-cols-[200px_1fr] lg:gap-10">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-clearance">
            — 09
          </span>
          <h2 className="mt-3 font-serif text-[22px] font-normal leading-[1.2] tracking-tight text-bone">
            Empty-leg watchlists
          </h2>
          <p className="mt-3 text-[13px] leading-[1.55] text-bone-2">
            Routes + date windows you want to be notified about when a repositioning leg lists.
            Pause to mute, remove to drop. New entries added from the public board.
          </p>
        </div>
        <WatchlistsSection initial={watchlistRows} />
      </div>
    </section>
  );
}
