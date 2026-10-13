import { requireAdmin } from "@/lib/auth";
import { voiceRouting } from "@/domain/settings/queries";
import { DeskHeader } from "@/components/admin/desk-ui";
import { RINGS_DEFAULT, RINGS_MAX, RINGS_MIN, NUMBERS_MAX, ringsWords } from "@/lib/voice-routing";
import { VoiceRoutingForm } from "./voice-routing-form";

export const dynamic = "force-dynamic";

// Settings › Voice agent. Owners only: the page gates, and so does the
// settings.voiceRouting op behind its form. Routing comes first; the
// agent's profile, knowledge, transfers and after-call steps follow.

export default async function VoiceAgentSettingsPage() {
  await requireAdmin();
  const routing = await voiceRouting();

  const ringChoices = Array.from({ length: RINGS_MAX - RINGS_MIN + 1 }, (_, i) => {
    const n = RINGS_MIN + i;
    return { value: n, label: `${ringsWords(n)}${n === RINGS_DEFAULT ? " · recommended" : ""}` };
  });

  return (
    <div>
      <DeskHeader
        size="md"
        title="Voice agent"
        lead="How calls to the JetNine line are answered. Your phone rings first; if nobody picks up, the agent takes the call."
      />

      <div className="mt-6">
        <VoiceRoutingForm routing={routing} ringChoices={ringChoices} maxNumbers={NUMBERS_MAX} />
      </div>

      <section className="card bg-panel mt-6 px-6 py-5">
        <h2 className="text-[16px] font-medium text-bone">What a caller hears</h2>
        <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-[15px] text-bone-2">
          <li>Ringing, while the numbers above ring at the same time. You see the caller&apos;s own number.</li>
          <li>
            With press 1 to accept on, whoever answers hears &ldquo;JetNine call, press 1 to accept&rdquo; and the call
            connects only when they press 1. The caller keeps hearing ringing meanwhile.
          </li>
          <li>
            If nobody answers (or presses 1) in time, the agent picks up with the normal greeting and handles the call
            itself: it takes the trip details and the best callback number and arranges a broker callback. It never
            transfers these calls back to you.
          </li>
          <li>
            If the agent is waking up, the caller hears &ldquo;One moment while I connect you&rdquo; for up to about
            forty seconds. If it still cannot answer, the caller leaves a voicemail, which is texted to the numbers
            above and emailed to dispatch.
          </li>
        </ol>
        <p className="mt-4 text-[14px] text-steel">
          Twilio setup: the JetNine number&apos;s &ldquo;A call comes in&rdquo; webhook is
          https://jetnine.com/api/voice/inbound (HTTP POST). Its fallback forwards straight to a mobile, so a caller
          still gets through if the site is down.
        </p>
      </section>
    </div>
  );
}
