import { REPLY_PROMISE_CHOICES } from "@/db/schema/desk";
import { requireStaff } from "@/lib/auth";
import { getNotificationPrefs, getReplyPromiseMinutes } from "@/lib/desk-settings";
import { deskRole } from "@/lib/desk-status";
import { DeskHeader } from "@/components/admin/desk-ui";
import { NotificationToggles } from "@/components/admin/settings/notification-toggles";
import { saveReplyPromise } from "./actions";

export const dynamic = "force-dynamic";

function promiseWords(min: number): string {
  return min === 60 ? "1 hour" : `${min} minutes`;
}

export default async function NotificationsPage() {
  const user = await requireStaff();
  const owner = deskRole(user.role) === "owner";
  const [prefs, promise] = await Promise.all([getNotificationPrefs(user.id), getReplyPromiseMinutes()]);

  const items = [
    {
      key: "newRequest",
      title: "A new request comes in",
      desc: "Email the moment a request lands, any hour",
      on: prefs.newRequest,
    },
    {
      key: "replyDueSoon",
      title: "A reply is about to be late",
      desc: "Email 10 minutes before the promise runs out",
      on: prefs.replyDueSoon,
    },
    {
      key: "clientPick",
      title: "A client picks an option",
      desc: "Email, so you can confirm the booking",
      on: prefs.clientPick,
    },
    {
      key: "morningSummary",
      title: "Morning summary",
      desc: "One email at 7 AM with today's flights and open requests",
      on: prefs.morningSummary,
    },
  ];

  return (
    <div>
      <DeskHeader size="md" title="Notifications" lead="How the desk gets your attention." />

      <div className="mt-6">
        <NotificationToggles items={items} />
      </div>

      <section className="card bg-panel mt-6 px-6 py-5">
        <h2 className="text-[16px] font-medium text-bone">Reply-time promise</h2>
        <p className="mt-1 text-[14px] text-steel">
          Requests turn amber when a reply is due and red when it is late. Every new request gets this much time
          on the clock.
        </p>
        {owner ? (
          <form action={saveReplyPromise} className="mt-3.5">
            <div className="segmented" role="group" aria-label="Reply-time promise">
              {REPLY_PROMISE_CHOICES.map((m) => (
                <button key={m} type="submit" name="minutes" value={m} aria-pressed={m === promise}>
                  {promiseWords(m)}
                </button>
              ))}
            </div>
          </form>
        ) : (
          <p className="mt-3.5 text-[15px] text-bone">
            {promiseWords(promise)} <span className="text-steel">· an owner can change this</span>
          </p>
        )}
      </section>
    </div>
  );
}
