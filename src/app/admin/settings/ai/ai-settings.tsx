"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { ProviderView, RouteView } from "@/lib/ai-providers";
import type { AiProviderKind } from "@/db/schema/ai";
import {
  deleteProviderKey,
  runProviderTest,
  saveProviderKey,
  saveProviderSettings,
  saveVoiceRoute,
  type ActionResult,
} from "./actions";

type Kind = {
  kind: AiProviderKind;
  label: string;
  keyPrefix: string;
  suggestedModel: string;
  console: string;
};

type Msg = { tone: "ok" | "error"; text: string } | null;

export function AiSettings({
  kinds,
  providers,
  route,
  disabled,
}: {
  kinds: Kind[];
  providers: ProviderView[];
  route: RouteView;
  disabled: boolean;
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
      {kinds.map((k) => (
        <ProviderCard
          key={k.kind}
          kind={k}
          row={providers.find((p) => p.provider === k.kind) ?? null}
          disabled={disabled}
        />
      ))}
      <div className="lg:col-span-2">
        <RouteCard providers={providers} route={route} disabled={disabled} />
      </div>
    </div>
  );
}

function ProviderCard({ kind, row, disabled }: { kind: Kind; row: ProviderView | null; disabled: boolean }) {
  const [msg, setMsg] = useState<Msg>(null);
  const [models, setModels] = useState<string[]>([]);
  const [pending, start] = useTransition();

  function submit(action: (fd: FormData) => Promise<ActionResult>) {
    return (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget;
      const data = new FormData(form);
      setMsg(null);
      start(async () => {
        const r = await action(data);
        if (r.ok) {
          setMsg({ tone: "ok", text: `CLEARED — ${r.message}` });
          const key = form.elements.namedItem("apiKey") as HTMLInputElement | null;
          if (key) key.value = "";
        } else {
          setMsg({ tone: "error", text: `BLOCKED — ${r.error}` });
        }
      });
    };
  }

  function test() {
    setMsg(null);
    const fd = new FormData();
    fd.set("provider", kind.kind);
    start(async () => {
      const r = await runProviderTest(fd);
      if (r.ok) {
        setModels(r.models);
        setMsg({ tone: r.modelKnown ? "ok" : "error", text: `${r.modelKnown ? "CLEARED" : "CHECK MODEL"} — ${r.note}` });
      } else {
        setMsg({ tone: "error", text: `BLOCKED — ${r.note}` });
      }
    });
  }

  function remove() {
    if (!confirm(`Remove the stored ${kind.label} key? Any route using it falls back.`)) return;
    const fd = new FormData();
    fd.set("provider", kind.kind);
    setMsg(null);
    start(async () => {
      const r = await deleteProviderKey(fd);
      setMsg(r.ok ? { tone: "ok", text: `CLEARED — ${r.message}` } : { tone: "error", text: `BLOCKED — ${r.error}` });
    });
  }

  const listId = `models-${kind.kind}`;

  return (
    <section className="border border-ink-3 p-6">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="caption mb-2">— {kind.kind}</p>
          <h2 className="font-serif text-[24px] font-light leading-tight text-bone">{kind.label}</h2>
        </div>
        <StatusPill row={row} />
      </header>

      {row ? (
        <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-3 font-mono text-[11px] uppercase tracking-[0.08em]">
          <Field label="Key">…{row.last4}</Field>
          <Field label="Model">{row.defaultModel}</Field>
          <Field label="Updated">{new Date(row.updatedAt).toLocaleString()}</Field>
          <Field label="Last test">
            {row.lastTestedAt
              ? `${row.lastTestOk ? "OK" : "FAILED"} · ${new Date(row.lastTestedAt).toLocaleString()}`
              : "never"}
          </Field>
          {row.lastTestNote ? (
            <div className="col-span-2 normal-case tracking-normal text-bone-2">{row.lastTestNote}</div>
          ) : null}
        </dl>
      ) : (
        <p className="mb-6 text-[13px] leading-[1.55] text-bone-2">
          No key stored. Create one at{" "}
          <a href={kind.console} target="_blank" rel="noreferrer" className="text-clearance underline">
            {new URL(kind.console).host}
          </a>{" "}
          and paste it below. It is encrypted before it is written.
        </p>
      )}

      {/* Key entry (create or replace) */}
      <form onSubmit={submit(saveProviderKey)} className="flex flex-col gap-4">
        <input type="hidden" name="provider" value={kind.kind} />
        <div className="field-jn">
          <label htmlFor={`${kind.kind}-key`}>{row ? "Replace key" : "API key"}</label>
          <input
            id={`${kind.kind}-key`}
            name="apiKey"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={`${kind.keyPrefix}…`}
            required
            disabled={disabled}
          />
        </div>
        {!row ? (
          <>
            <div className="field-jn">
              <label htmlFor={`${kind.kind}-label`}>Label</label>
              <input id={`${kind.kind}-label`} name="label" defaultValue={kind.label} maxLength={60} disabled={disabled} />
            </div>
            <div className="field-jn">
              <label htmlFor={`${kind.kind}-model`}>Default model</label>
              <input
                id={`${kind.kind}-model`}
                name="defaultModel"
                defaultValue={kind.suggestedModel}
                list={listId}
                disabled={disabled}
              />
            </div>
          </>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="btn btn-primary btn-sm" disabled={pending || disabled}>
            {row ? "Replace key" : "Store key"}
          </button>
        </div>
      </form>

      {/* Settings for an existing row */}
      {row ? (
        <form onSubmit={submit(saveProviderSettings)} className="mt-6 flex flex-col gap-4 border-t border-ink-3 pt-6">
          <input type="hidden" name="provider" value={kind.kind} />
          <div className="field-jn">
            <label htmlFor={`${kind.kind}-label2`}>Label</label>
            <input id={`${kind.kind}-label2`} name="label" defaultValue={row.label} maxLength={60} disabled={disabled} />
          </div>
          <div className="field-jn">
            <label htmlFor={`${kind.kind}-model2`}>Default model</label>
            <input
              id={`${kind.kind}-model2`}
              name="defaultModel"
              defaultValue={row.defaultModel}
              list={listId}
              disabled={disabled}
            />
            {models.length ? (
              <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
                — {models.length} models loaded from the vendor; start typing to pick one
              </p>
            ) : null}
          </div>
          <label className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.08em] text-bone-2">
            <input type="checkbox" name="enabled" defaultChecked={row.enabled} disabled={disabled} />
            Enabled for routing
          </label>
          <div className="flex flex-wrap gap-3">
            <button type="submit" className="btn btn-secondary btn-sm" disabled={pending || disabled}>
              Save settings
            </button>
            <button type="button" onClick={test} className="btn btn-secondary btn-sm" disabled={pending || disabled}>
              Test key
            </button>
            <button type="button" onClick={remove} className="btn btn-ghost btn-sm" disabled={pending || disabled}>
              Remove key
            </button>
          </div>
        </form>
      ) : null}

      <datalist id={listId}>
        {models.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>

      {msg ? (
        <p
          className={`mt-5 font-mono text-[11px] uppercase tracking-[0.08em] ${
            msg.tone === "ok" ? "text-[var(--success)]" : "text-[var(--error)]"
          }`}
        >
          {msg.text}
        </p>
      ) : null}
    </section>
  );
}

function RouteCard({ providers, route, disabled }: { providers: ProviderView[]; route: RouteView; disabled: boolean }) {
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const usable = providers.filter((p) => p.enabled);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setMsg(null);
    start(async () => {
      const r = await saveVoiceRoute(data);
      setMsg(r.ok ? { tone: "ok", text: `CLEARED — ${r.message}` } : { tone: "error", text: `BLOCKED — ${r.error}` });
    });
  }

  return (
    <section className="border border-ink-3 p-6">
      <header className="mb-6">
        <p className="caption mb-2">— routing</p>
        <h2 className="font-serif text-[24px] font-light leading-tight text-bone">Voice desk</h2>
        <p className="mt-2 max-w-[64ch] text-[13px] leading-[1.55] text-bone-2">
          The primary provider runs every call. If it errors before the caller has heard anything,
          the same turn is retried on the fallback. Each provider uses its own default model. With
          no primary set, the service uses the ANTHROPIC_API_KEY environment variable on Render.
        </p>
      </header>
      <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <div className="field-jn">
          <label htmlFor="route-primary">Primary</label>
          <select id="route-primary" name="primaryProviderId" defaultValue={route.primaryProviderId ?? ""} disabled={disabled}>
            <option value="">— Environment key (Render) —</option>
            {usable.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} · {p.defaultModel}
              </option>
            ))}
          </select>
        </div>
        <div className="field-jn">
          <label htmlFor="route-fallback">Fallback</label>
          <select id="route-fallback" name="fallbackProviderId" defaultValue={route.fallbackProviderId ?? ""} disabled={disabled}>
            <option value="">— None —</option>
            {usable.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} · {p.defaultModel}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending || disabled}>
          Save routing
        </button>
      </form>
      {msg ? (
        <p
          className={`mt-5 font-mono text-[11px] uppercase tracking-[0.08em] ${
            msg.tone === "ok" ? "text-[var(--success)]" : "text-[var(--error)]"
          }`}
        >
          {msg.text}
        </p>
      ) : null}
    </section>
  );
}

function StatusPill({ row }: { row: ProviderView | null }) {
  const [cls, text] = !row
    ? ["border-steel text-steel", "not set"]
    : !row.enabled
      ? ["border-steel text-steel", "disabled"]
      : row.lastTestOk === false
        ? ["border-[var(--error)] text-[var(--error)]", "test failed"]
        : row.lastTestOk
          ? ["border-[var(--success)] text-[var(--success)]", "verified"]
          : ["border-[var(--warn)] text-[var(--warn)]", "untested"];
  return (
    <span className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${cls}`}>{text}</span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-steel">{label}</dt>
      <dd className="mt-1 text-bone">{children}</dd>
    </div>
  );
}
