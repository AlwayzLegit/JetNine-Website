"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import type { VoiceAgentConfig } from "@/lib/voice-agent-config";
import {
  archiveVoiceAgent,
  createVoiceAgent,
  makeVoiceAgentLive,
  restoreVoiceAgentVersion,
  saveVoiceAgent,
} from "../../actions";

type Agent = {
  id: string;
  name: string;
  description: string;
  version: number;
  isLive: boolean;
  archived: boolean;
  config: VoiceAgentConfig;
};

type Version = { version: number; note: string | null; createdAt: string; by: string | null };

type Choices = {
  ttsProviders: string[];
  elevenLabsModels: string[];
  voices: { id: string; label: string }[];
  sttProviders: string[];
  interruptSensitivity: string[];
  llmModels: { id: string; label: string }[];
};

type Msg = { tone: "ok" | "error"; text: string } | null;

const WHEN = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const TRANSFER_TRIGGERS: { key: keyof VoiceAgentConfig["calls"]["transfers"]; label: string }[] = [
  { key: "departureWithin48h", label: "The trip departs within 48 hours" },
  { key: "askForPerson", label: "The caller asks for a person" },
  { key: "activeTrip", label: "The caller is a client with an active trip" },
  { key: "struggling", label: "The agent can't understand twice in a row, or the caller is frustrated" },
  { key: "inFlightOrSafety", label: "A flight in progress, a delay, or a safety concern" },
];

export function AgentEditor({ agent, versions, choices }: { agent: Agent; versions: Version[]; choices: Choices }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description);
  const [note, setNote] = useState("");
  const [c, setC] = useState<VoiceAgentConfig>(agent.config);
  const readOnly = agent.archived;

  const presetVoice = choices.voices.some((v) => v.id === c.voice.voiceId);
  const [customVoice, setCustomVoice] = useState(!presetVoice);

  function patch<K extends keyof VoiceAgentConfig>(section: K, value: Partial<VoiceAgentConfig[K]>) {
    setC((prev) => ({ ...prev, [section]: { ...prev[section], ...value } }));
  }

  function act(fn: () => Promise<{ ok: true; id?: string; changed?: boolean } | { ok: false; error: string }>, done: string) {
    setMsg(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        setMsg({ tone: "error", text: r.error });
        return;
      }
      setMsg({ tone: "ok", text: r.changed === false ? "Nothing to change." : done });
      if (r.id && r.id !== agent.id) router.push(`/admin/settings/voice/agents/${r.id}`);
      else router.refresh();
    });
  }

  const save = () =>
    act(async () => {
      const r = await saveVoiceAgent({ id: agent.id, name, description, config: c, note });
      if (r.ok) setNote("");
      return r;
    }, agent.isLive ? "Saved. The next call uses these settings." : "Saved.");

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <fieldset disabled={readOnly || pending} className="flex min-w-0 flex-col gap-6">
        <Card title="Profile" lead="What the agent is called on this screen, and the first thing a caller hears.">
          <Field label="Name" id="a-name">
            <input id="a-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Description (only you see this)" id="a-desc">
            <input id="a-desc" value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field
            label="Greeting"
            id="a-greet"
            hint="Spoken as soon as the agent picks up. The recording notice is added automatically while recording is on."
          >
            <textarea id="a-greet" rows={2} value={c.profile.greeting} onChange={(e) => patch("profile", { greeting: e.target.value })} />
          </Field>
          <Field label="Language" id="a-lang" hint="Like en-US. The voice and speech recognition must support it.">
            <input id="a-lang" value={c.profile.language} onChange={(e) => patch("profile", { language: e.target.value })} />
          </Field>
        </Card>

        <Card title="Voice" lead="How the agent sounds. Test a new voice with a call before making the agent live: an unknown voice ID ends the call.">
          <Row>
            <Field label="Provider" id="v-prov">
              <select id="v-prov" value={c.voice.provider} onChange={(e) => patch("voice", { provider: e.target.value as VoiceAgentConfig["voice"]["provider"] })}>
                {choices.ttsProviders.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
            {c.voice.provider === "ElevenLabs" ? (
              <Field label="Model" id="v-model" hint="Flash is fastest.">
                <select id="v-model" value={c.voice.model} onChange={(e) => patch("voice", { model: e.target.value as VoiceAgentConfig["voice"]["model"] })}>
                  <option value="">Provider default</option>
                  {choices.elevenLabsModels.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </Field>
            ) : null}
          </Row>
          {c.voice.provider === "ElevenLabs" && !customVoice ? (
            <Field label="Voice" id="v-voice">
              <select
                id="v-voice"
                value={c.voice.voiceId}
                onChange={(e) => {
                  if (e.target.value === "__custom") setCustomVoice(true);
                  else patch("voice", { voiceId: e.target.value });
                }}
              >
                {choices.voices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
                <option value="__custom">Custom voice ID…</option>
              </select>
            </Field>
          ) : (
            <Field
              label={c.voice.provider === "ElevenLabs" ? "Custom voice ID" : "Voice name"}
              id="v-custom"
              hint={
                c.voice.provider === "ElevenLabs"
                  ? "Copy an ID from the ElevenLabs voice library. Empty uses Twilio's default voice."
                  : "For example en-US-Neural2-D (Google) or Matthew-Neural (Amazon)."
              }
            >
              <input id="v-custom" value={c.voice.voiceId} onChange={(e) => patch("voice", { voiceId: e.target.value.trim() })} />
              {c.voice.provider === "ElevenLabs" ? (
                <button type="button" className="mt-1.5 text-link text-[13px]" onClick={() => setCustomVoice(false)}>
                  Pick from the list instead
                </button>
              ) : null}
            </Field>
          )}
          {c.voice.provider === "ElevenLabs" ? (
            <Row>
              <Range label="Speed" id="v-speed" min={0.7} max={1.2} step={0.05} value={c.voice.speed} onChange={(v) => patch("voice", { speed: v })} hint="Below 1 is slower." />
              <Range label="Stability" id="v-stab" min={0} max={1} step={0.05} value={c.voice.stability} onChange={(v) => patch("voice", { stability: v })} hint="Lower is more expressive." />
              <Range label="Similarity" id="v-sim" min={0} max={1} step={0.05} value={c.voice.similarity} onChange={(v) => patch("voice", { similarity: v })} hint="Closeness to the original voice." />
            </Row>
          ) : null}
        </Card>

        <Card title="Listening" lead="How the agent hears the caller and when it decides they have finished talking.">
          <Row>
            <Field label="Speech recognition" id="s-prov">
              <select id="s-prov" value={c.speech.provider} onChange={(e) => patch("speech", { provider: e.target.value as VoiceAgentConfig["speech"]["provider"] })}>
                {choices.sttProviders.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
            <Field label="Model" id="s-model" hint="Deepgram: nova-3-general. Google: telephony.">
              <input id="s-model" value={c.speech.model} onChange={(e) => patch("speech", { model: e.target.value.trim() })} />
            </Field>
          </Row>
          <Row>
            <Field label="Wait after the caller stops talking" id="s-timeout" hint="Shorter replies faster but may cut people off.">
              <select
                id="s-timeout"
                value={c.speech.speechTimeoutMs ?? ""}
                onChange={(e) => patch("speech", { speechTimeoutMs: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">Automatic (recommended)</option>
                {[600, 800, 1000, 1500, 2000, 3000].map((ms) => (
                  <option key={ms} value={ms}>
                    {(ms / 1000).toFixed(1)} seconds
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Interruptions" id="s-int" hint="How easily the caller can talk over the agent.">
              <select
                id="s-int"
                value={c.speech.interruptSensitivity}
                onChange={(e) => patch("speech", { interruptSensitivity: e.target.value as VoiceAgentConfig["speech"]["interruptSensitivity"] })}
              >
                {choices.interruptSensitivity.map((s) => (
                  <option key={s} value={s}>
                    {s === "high" ? "Easy (high)" : s === "medium" ? "Balanced (medium)" : "Hard (low)"}
                  </option>
                ))}
              </select>
            </Field>
          </Row>
          <Check checked={c.speech.ignoreBackchannel} onChange={(v) => patch("speech", { ignoreBackchannel: v })}>
            Ignore &ldquo;uh-huh&rdquo;, &ldquo;yeah&rdquo; and &ldquo;okay&rdquo; while the agent speaks
          </Check>
          <Check checked={c.speech.greetingInterruptible} onChange={(v) => patch("speech", { greetingInterruptible: v })}>
            Let the caller interrupt the greeting <span className="text-steel">(off stops speakerphone echo cutting it short)</span>
          </Check>
          <Field label="Words to listen for" id="s-hints" hint="Comma-separated names and terms the recognizer should expect.">
            <input id="s-hints" value={c.speech.hints} onChange={(e) => patch("speech", { hints: e.target.value })} />
          </Field>
        </Card>

        <Card title="AI model" lead="The model that writes the agent's replies. Faster models answer sooner.">
          <Field label="Model" id="m-model" hint="Empty uses the default set on Settings › Connections › Phone answering.">
            <input id="m-model" list="m-models" value={c.llm.model} placeholder="Phone answering default" onChange={(e) => patch("llm", { model: e.target.value.trim() })} />
            <datalist id="m-models">
              {choices.llmModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </datalist>
          </Field>
          <ul className="text-[13px] text-steel">
            {choices.llmModels.map((m) => (
              <li key={m.id}>
                <button type="button" className="text-link" onClick={() => patch("llm", { model: m.id })}>
                  {m.id}
                </button>{" "}
                · {m.label.split(" · ")[1]}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Instructions and knowledge" lead="What the agent does on a call, what it knows about JetNine, and what it must never say.">
          <Field label="Personality and tone" id="i-pers">
            <textarea id="i-pers" rows={2} value={c.instructions.personality} onChange={(e) => patch("instructions", { personality: e.target.value })} />
          </Field>
          <Field label="Instructions" id="i-main" hint="The agent's playbook. Transfer rules come from Call handling below, so leave them out of here.">
            <textarea id="i-main" rows={16} className="font-mono text-[13px]" value={c.instructions.main} onChange={(e) => patch("instructions", { main: e.target.value })} />
          </Field>
          <Field label="Knowledge" id="i-know" hint="Facts and FAQ answers the agent may use. One per line.">
            <textarea id="i-know" rows={8} value={c.instructions.knowledge} onChange={(e) => patch("instructions", { knowledge: e.target.value })} />
          </Field>
          <Field label="Never say" id="i-never" hint="Topics, words or promises to avoid. One per line.">
            <textarea id="i-never" rows={3} value={c.instructions.neverSay} onChange={(e) => patch("instructions", { neverSay: e.target.value })} />
          </Field>
        </Card>

        <Card
          title="Call handling"
          lead="When the agent hands a call to a person. Calls you already skipped with ring-first are never transferred back, whatever is set here."
        >
          <Check
            checked={c.calls.transfers.enabled}
            onChange={(v) => patch("calls", { transfers: { ...c.calls.transfers, enabled: v } })}
          >
            Transfer to a broker when…
          </Check>
          <div className={`ml-7 flex flex-col gap-2 ${c.calls.transfers.enabled ? "" : "opacity-50"}`}>
            {TRANSFER_TRIGGERS.map((t) => (
              <Check
                key={t.key}
                disabled={!c.calls.transfers.enabled}
                checked={c.calls.transfers[t.key]}
                onChange={(v) => patch("calls", { transfers: { ...c.calls.transfers, [t.key]: v } })}
              >
                {t.label}
              </Check>
            ))}
          </div>
          <Field label="Transfer to" id="c-num" hint="E.164, like +18185550123. Empty uses the number set on the voice service (ESCALATION_PHONE).">
            <input id="c-num" value={c.calls.transferNumber} placeholder="Voice service default" onChange={(e) => patch("calls", { transferNumber: e.target.value.trim() })} />
          </Field>
          <Check checked={c.calls.askCallbackTime} onChange={(v) => patch("calls", { askCallbackTime: v })}>
            When there is no transfer, ask when the caller would like a broker to call back
          </Check>
          <Field label="Longest call (minutes)" id="c-max" hint="The agent wraps up politely after this long.">
            <input
              id="c-max"
              type="number"
              min={2}
              max={60}
              value={c.calls.maxCallMinutes}
              onChange={(e) => patch("calls", { maxCallMinutes: Number(e.target.value) || 15 })}
            />
          </Field>
        </Card>
      </fieldset>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-5 lg:self-start">
        <section className="card bg-panel p-5">
          <p className="text-[13px] text-steel">
            Version {agent.version}
            {agent.isLive ? " · live" : ""}
          </p>
          {!readOnly ? (
            <>
              <div className="field-jn mt-3">
                <label htmlFor="a-note">What changed (optional)</label>
                <input id="a-note" value={note} maxLength={200} placeholder="Slower voice, shorter greeting" onChange={(e) => setNote(e.target.value)} />
              </div>
              <button type="button" className="btn btn-primary btn-sm mt-3 w-full" disabled={pending} onClick={save}>
                {pending ? "Working…" : "Save as new version"}
              </button>
              {!agent.isLive ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm mt-2 w-full"
                  disabled={pending}
                  onClick={() => act(() => makeVoiceAgentLive(agent.id), "Live. The next call uses this agent.")}
                >
                  Make live
                </button>
              ) : null}
            </>
          ) : null}
          <button
            type="button"
            className="btn btn-secondary btn-sm mt-2 w-full"
            disabled={pending}
            onClick={() => act(() => createVoiceAgent({ name: `${agent.name} (copy)`, fromAgentId: agent.id }), "Copied.")}
          >
            Duplicate
          </button>
          {!agent.isLive ? (
            <button
              type="button"
              className="btn btn-sm mt-2 w-full text-danger"
              disabled={pending}
              onClick={() =>
                act(() => archiveVoiceAgent(agent.id, !agent.archived), agent.archived ? "Restored." : "Archived.")
              }
            >
              {agent.archived ? "Restore agent" : "Archive"}
            </button>
          ) : null}
          {msg ? (
            <p role="status" className={`mt-3 text-[14px] ${msg.tone === "ok" ? "text-success" : "text-danger"}`}>
              {msg.text}
            </p>
          ) : null}
          {!readOnly ? <p className="mt-3 text-[12px] text-steel">Unsaved changes are lost if you leave this page.</p> : null}
        </section>

        <section className="card bg-panel p-5">
          <h2 className="text-[14px] font-semibold text-bone">Versions</h2>
          <ul className="mt-2 flex flex-col gap-2.5">
            {versions.map((v) => (
              <li key={v.version} className="text-[13px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-bone">v{v.version}</span>
                  {v.version !== agent.version && !readOnly ? (
                    <button
                      type="button"
                      className="text-link"
                      disabled={pending}
                      onClick={() => act(() => restoreVoiceAgentVersion(agent.id, v.version), `Restored version ${v.version} as a new version.`)}
                    >
                      Restore
                    </button>
                  ) : v.version === agent.version ? (
                    <span className="text-steel">current</span>
                  ) : null}
                </div>
                <p className="text-steel">
                  {WHEN.format(new Date(v.createdAt))}
                  {v.by ? ` · ${v.by}` : ""}
                </p>
                {v.note ? <p className="text-bone-2">{v.note}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}

function Card({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <section className="card bg-panel p-6">
      <h2 className="title-card-sm text-bone">{title}</h2>
      <p className="mt-1.5 max-w-[68ch] text-[14px] text-steel">{lead}</p>
      <div className="mt-4 flex flex-col gap-3.5">{children}</div>
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

function Field({ label, id, hint, children }: { label: string; id: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field-jn">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? <p className="mt-1.5 text-[13px] text-steel">{hint}</p> : null}
    </div>
  );
}

function Range(props: { label: string; id: string; min: number; max: number; step: number; value: number; hint?: string; onChange: (v: number) => void }) {
  return (
    <div className="field-jn">
      <label htmlFor={props.id}>
        {props.label} <span className="font-normal text-steel">· {props.value.toFixed(2)}</span>
      </label>
      <input
        id={props.id}
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        className="!border-0 !p-0"
        onChange={(e) => props.onChange(Math.round(Number(e.target.value) * 100) / 100)}
      />
      {props.hint ? <p className="mt-1.5 text-[13px] text-steel">{props.hint}</p> : null}
    </div>
  );
}

function Check({ checked, onChange, disabled, children }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; children: ReactNode }) {
  return (
    <label className="flex items-start gap-3 text-[15px] text-bone">
      <input type="checkbox" className="mt-1" checked={checked} disabled={disabled} onChange={(e) => onChange(e.currentTarget.checked)} />
      <span>{children}</span>
    </label>
  );
}
