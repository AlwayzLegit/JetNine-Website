"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { ProviderView, RouteView } from "@/lib/ai-providers";
import type { AiProviderKind } from "@/db/schema/ai";
import { DotSentence } from "@/components/admin/desk-ui";
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

const WHEN = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

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
    <div className="grid gap-4 lg:grid-cols-2">
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

function Message({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p role="status" className={`mt-4 text-[14px] ${msg.tone === "ok" ? "text-success" : "text-danger"}`}>
      {msg.text}
    </p>
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
          setMsg({ tone: "ok", text: r.message });
          const key = form.elements.namedItem("apiKey") as HTMLInputElement | null;
          if (key) key.value = "";
        } else {
          setMsg({ tone: "error", text: r.error });
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
        setMsg({ tone: r.modelKnown ? "ok" : "error", text: r.note });
      } else {
        setMsg({ tone: "error", text: r.note });
      }
    });
  }

  function remove() {
    if (!confirm(`Remove the stored ${kind.label} key? Anything routed to it falls back.`)) return;
    const fd = new FormData();
    fd.set("provider", kind.kind);
    setMsg(null);
    start(async () => {
      const r = await deleteProviderKey(fd);
      setMsg(r.ok ? { tone: "ok", text: r.message } : { tone: "error", text: r.error });
    });
  }

  const listId = `models-${kind.kind}`;

  return (
    <section className="card bg-panel p-6">
      <header className="flex items-start justify-between gap-4">
        <h2 className="title-card-sm text-bone">{kind.label}</h2>
        <Status row={row} />
      </header>

      {row ? (
        <dl className="dl-jn mt-5">
          <dt>Key</dt>
          <dd>…{row.last4}</dd>
          <dt>Model</dt>
          <dd>{row.defaultModel}</dd>
          <dt>Updated</dt>
          <dd>{WHEN.format(new Date(row.updatedAt))}</dd>
          <dt>Last test</dt>
          <dd>
            {row.lastTestedAt
              ? `${row.lastTestOk ? "Passed" : "Failed"} · ${WHEN.format(new Date(row.lastTestedAt))}`
              : "Not tested yet"}
          </dd>
          {row.lastTestNote ? (
            <>
              <dt>Note</dt>
              <dd className="text-bone-2">{row.lastTestNote}</dd>
            </>
          ) : null}
        </dl>
      ) : (
        <p className="mt-4 text-[15px] text-bone-2">
          No key stored. Create one at{" "}
          <a href={kind.console} target="_blank" rel="noreferrer" className="text-link">
            {new URL(kind.console).host} ↗
          </a>{" "}
          and paste it below. It is encrypted before it is written.
        </p>
      )}

      {/* Key entry (create or replace) */}
      <form onSubmit={submit(saveProviderKey)} className="mt-5 flex flex-col gap-2.5">
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
        <div className="mt-1.5 flex flex-wrap gap-2.5">
          <button type="submit" className="btn btn-primary btn-sm" disabled={pending || disabled}>
            {row ? "Replace key" : "Store key"}
          </button>
        </div>
      </form>

      {/* Settings for an existing row */}
      {row ? (
        <form onSubmit={submit(saveProviderSettings)} className="mt-6 flex flex-col gap-2.5 border-t border-line-faint pt-6">
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
              <p className="mt-1.5 text-[13px] text-steel">
                {models.length} models loaded from the vendor; start typing to pick one.
              </p>
            ) : null}
          </div>
          <label className="flex items-center gap-3 text-[15px] text-bone-2">
            <input type="checkbox" name="enabled" defaultChecked={row.enabled} disabled={disabled} />
            Available to answer the phone
          </label>
          <div className="mt-1.5 flex flex-wrap gap-2.5">
            <button type="submit" className="btn btn-secondary btn-sm" disabled={pending || disabled}>
              Save settings
            </button>
            <button type="button" onClick={test} className="btn btn-secondary btn-sm" disabled={pending || disabled}>
              Test key
            </button>
            <button type="button" onClick={remove} className="btn btn-sm text-danger" disabled={pending || disabled}>
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

      <Message msg={msg} />
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
      setMsg(r.ok ? { tone: "ok", text: r.message } : { tone: "error", text: r.error });
    });
  }

  return (
    <section className="card bg-panel p-6">
      <header>
        <h2 className="title-card-sm text-bone">Who answers the phone</h2>
        <p className="mt-2 max-w-[64ch] text-[15px] text-bone-2">
          The first choice takes every call. If it fails before the caller has heard anything, the same turn is
          retried on the backup. Each provider uses its own default model. With no first choice set, the service
          uses the ANTHROPIC_API_KEY environment variable on Render.
        </p>
      </header>
      <form onSubmit={onSubmit} className="mt-5 grid gap-2.5 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <div className="field-jn">
          <label htmlFor="route-primary">Answers first</label>
          <select id="route-primary" name="primaryProviderId" defaultValue={route.primaryProviderId ?? ""} disabled={disabled}>
            <option value="">Environment key on Render</option>
            {usable.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} · {p.defaultModel}
              </option>
            ))}
          </select>
        </div>
        <div className="field-jn">
          <label htmlFor="route-fallback">Backup</label>
          <select id="route-fallback" name="fallbackProviderId" defaultValue={route.fallbackProviderId ?? ""} disabled={disabled}>
            <option value="">None</option>
            {usable.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} · {p.defaultModel}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending || disabled}>
          Save
        </button>
      </form>
      <Message msg={msg} />
    </section>
  );
}

function Status({ row }: { row: ProviderView | null }) {
  const [tone, text]: ["success" | "gold" | "danger" | "steel", string] = !row
    ? ["steel", "No key"]
    : !row.enabled
      ? ["steel", "Switched off"]
      : row.lastTestOk === false
        ? ["danger", "Test failed"]
        : row.lastTestOk
          ? ["success", "Working"]
          : ["gold", "Not tested yet"];
  return (
    <DotSentence tone={tone} className="flex-none text-[14px] text-bone-2">
      {text}
    </DotSentence>
  );
}
