"use client";

import { useState, useTransition, type FormEvent } from "react";
import { phoneWords, type VoiceRouting } from "@/lib/voice-routing";
import { saveVoiceRouting } from "./actions";

type Msg = { tone: "ok" | "error"; text: string } | null;

export function VoiceRoutingForm({
  routing,
  ringChoices,
  maxNumbers,
}: {
  routing: VoiceRouting;
  ringChoices: { value: number; label: string }[];
  maxNumbers: number;
}) {
  const [ringFirst, setRingFirst] = useState(routing.ringFirst);
  const [screen, setScreen] = useState(routing.screen);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const slots = Array.from({ length: maxNumbers }, (_, i) => routing.numbers[i] ?? "");

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setMsg(null);
    start(async () => {
      const r = await saveVoiceRouting(data);
      setMsg(
        r.ok
          ? { tone: "ok", text: r.changed ? "Saved. The next call follows these settings." : "No changes to save." }
          : { tone: "error", text: r.error },
      );
    });
  }

  return (
    <section className="card bg-panel p-6">
      <header>
        <h2 className="title-card-sm text-bone">Routing</h2>
        <p className="mt-2 max-w-[64ch] text-[15px] text-bone-2">
          Who a call rings before the agent answers. Every day, around the clock.
        </p>
      </header>

      <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-4">
        <label className="flex items-center gap-3 text-[15px] text-bone">
          <input
            type="checkbox"
            name="ringFirst"
            checked={ringFirst}
            onChange={(e) => setRingFirst(e.currentTarget.checked)}
          />
          Ring these numbers first
        </label>
        {!ringFirst ? (
          <p className="-mt-2 text-[14px] text-steel">Off: the agent answers every call straight away.</p>
        ) : null}

        <fieldset className={`flex flex-col gap-2.5 ${ringFirst ? "" : "opacity-60"}`}>
          <legend className="text-[14px] text-steel">Rung together; the first to answer takes the call.</legend>
          {slots.map((n, i) => (
            <div key={i} className="field-jn">
              <label htmlFor={`voice-number-${i}`}>{i === 0 ? "Phone number" : `Phone number ${i + 1} (optional)`}</label>
              <input
                id={`voice-number-${i}`}
                name="number"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                defaultValue={n ? phoneWords(n) : ""}
                placeholder="(818) 555-0123"
              />
            </div>
          ))}
        </fieldset>

        <div className="field-jn">
          <label htmlFor="voice-rings">Agent answers after</label>
          <select id="voice-rings" name="rings" defaultValue={routing.rings}>
            {ringChoices.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-start gap-3 text-[15px] text-bone">
          <input
            type="checkbox"
            name="screen"
            className="mt-1"
            checked={screen}
            onChange={(e) => setScreen(e.currentTarget.checked)}
          />
          <span>
            Press 1 to accept <span className="text-steel">· recommended</span>
            <span className="mt-0.5 block text-[14px] text-steel">
              When you answer you hear &ldquo;JetNine call, press 1 to accept.&rdquo; Any other key, no key, or hanging up sends the caller to the agent. Your phone&apos;s voicemail
              can&apos;t press 1, so a call it picks up still goes to the agent.
            </span>
          </span>
        </label>

        <div className="rounded-md border border-line px-4 py-3 text-[14px] text-bone-2">
          {screen ? (
            <p>
              <strong className="font-medium text-bone">Declining is fine.</strong> If you decline or don&apos;t press
              1, the caller goes to the agent, not your voicemail.
            </p>
          ) : (
            <>
              <p>
                <strong className="font-medium text-bone">Let it ring out.</strong> If you decline, most phones send
                the caller to your own voicemail and the agent never answers.
              </p>
              <p className="mt-1.5">
                Keep the window shorter than your phone&apos;s voicemail, which usually answers after 20 to 30 seconds.
                If your voicemail answers first, the caller hears your voicemail, not the agent.
              </p>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
            {pending ? "Saving…" : "Save routing"}
          </button>
        </div>
        {msg ? (
          <p role="status" className={`text-[14px] ${msg.tone === "ok" ? "text-success" : "text-danger"}`}>
            {msg.text}
          </p>
        ) : null}
      </form>
    </section>
  );
}
