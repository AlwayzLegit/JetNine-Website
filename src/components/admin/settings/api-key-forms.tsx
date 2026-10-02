"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { KeyTemplate } from "@/lib/api-keys";
import { DeskHeader } from "@/components/admin/desk-ui";
import { createApiKey, revokeApiKey } from "@/app/admin/settings/api-keys/actions";

type Msg = { tone: "ok" | "error"; text: string } | null;
type ScopeOption = { scope: string; label: string; can: string };
type ExpiryOption = { value: string; label: string };

function Message({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p role="status" className={`text-[14px] ${msg.tone === "ok" ? "text-success" : "text-danger"}`}>
      {msg.text}
    </p>
  );
}

/**
 * Header with "+ Create a key", the create form (template or custom
 * permissions, asks first, expiry) and the one-time token panel.
 */
export function ApiKeysHeader({
  templates,
  scopes,
  expiry,
}: {
  templates: KeyTemplate[];
  scopes: ScopeOption[];
  expiry: ExpiryOption[];
}) {
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState<string>(templates[0]?.id ?? "custom");
  const [custom, setCustom] = useState<Set<string>>(new Set(["read"]));
  const [msg, setMsg] = useState<Msg>(null);
  const [created, setCreated] = useState<{ name: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const tpl = templates.find((t) => t.id === template);
  const defaultExpiry = tpl ? (tpl.expiresInDays === null ? "never" : String(tpl.expiresInDays)) : "90";
  const agentPicked = template === "custom" && custom.has("agent");

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setMsg(null);
    start(async () => {
      const r = await createApiKey(data);
      if (r.ok) {
        setCreated({ name: r.name, token: r.token });
        setCopied(false);
        setOpen(false);
      } else {
        setMsg({ tone: "error", text: r.error });
      }
    });
  }

  async function copy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.token);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <DeskHeader
        title="API keys"
        lead="Keys for the daily assistant and your own scripts. Create, see when each was last used, revoke."
        actions={
          <button
            type="button"
            className="btn btn-primary"
            aria-expanded={open}
            aria-controls="key-create"
            onClick={() => {
              setOpen((v) => !v);
              setMsg(null);
            }}
          >
            {open ? "Close" : "+ Create a key"}
          </button>
        }
      />

      {created ? (
        <div className="card mt-6 border-gold/40 p-6" role="region" aria-label="Your new key">
          <h2 className="text-[17px] font-medium text-bone">“{created.name}” is ready</h2>
          <p className="mt-1 text-[14px] text-bone-2">
            Copy it now. This is the only time it is shown; if it is lost, revoke it and create another.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <code className="min-w-0 flex-1 break-all rounded-control bg-surface-2 px-3 py-2.5 font-mono text-[13px] text-bone">
              {created.token}
            </code>
            <button type="button" className="btn btn-secondary btn-sm" onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setCreated(null)}>
              Done
            </button>
          </div>
        </div>
      ) : null}

      {open ? (
        <form id="key-create" onSubmit={onSubmit} className="card mt-6 p-6">
          <h2 className="text-[17px] font-medium text-bone">Create a key</h2>

          <fieldset className="mt-4">
            <legend className="text-[14px] text-steel">Start from</legend>
            <div className="mt-2 grid gap-2.5 md:grid-cols-2">
              {[...templates, { id: "custom", name: "Choose permissions", note: "Pick exactly what this key may do." }].map((t) => (
                <label
                  key={t.id}
                  className={`flex cursor-pointer gap-3 rounded-control border p-3.5 ${template === t.id ? "border-gold/60 bg-surface-2" : "border-line-faint"}`}
                >
                  <input
                    type="radio"
                    name="template"
                    value={t.id}
                    checked={template === t.id}
                    onChange={() => setTemplate(t.id)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-[15px] text-bone">{t.name}</span>
                    <span className="block text-[14px] text-steel">{t.note}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {template === "custom" ? (
            <fieldset className="mt-5">
              <legend className="text-[14px] text-steel">Permissions</legend>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {scopes.map((s) => (
                  <label key={s.scope} className="flex cursor-pointer gap-3 text-[15px]">
                    <input
                      type="checkbox"
                      name="scopes"
                      value={s.scope}
                      checked={custom.has(s.scope)}
                      onChange={(e) => {
                        const next = new Set(custom);
                        if (e.target.checked) next.add(s.scope);
                        else next.delete(s.scope);
                        setCustom(next);
                      }}
                      className="mt-1"
                    />
                    <span>
                      <span className="text-bone">{s.label}</span>
                      <span className="block text-[14px] text-steel">{s.can}</span>
                    </span>
                  </label>
                ))}
              </div>
              <label className="mt-4 flex cursor-pointer gap-3 text-[15px]">
                <input
                  type="checkbox"
                  name="supervised"
                  defaultChecked
                  disabled={agentPicked}
                  className="mt-1"
                  key={agentPicked ? "forced" : "free"}
                />
                <span>
                  <span className="text-bone">Ask before contacting clients, moving money or changing settings</span>
                  <span className="block text-[14px] text-steel">
                    {agentPicked ? "Always on for assistant keys." : "Those actions wait for a person's OK."}
                  </span>
                </span>
              </label>
              {agentPicked ? <input type="hidden" name="supervised" value="on" /> : null}
            </fieldset>
          ) : null}

          <div className="mt-5 grid gap-2.5 md:grid-cols-2">
            <div className="field-jn">
              <label htmlFor="key-name">Name</label>
              <input
                id="key-name"
                name="name"
                type="text"
                required
                maxLength={60}
                autoComplete="off"
                defaultValue={tpl?.name ?? ""}
                key={template}
              />
            </div>
            <div className="field-jn">
              <label htmlFor="key-expiry">Expires</label>
              <select id="key-expiry" name="expiresInDays" defaultValue={defaultExpiry} key={template}>
                {expiry.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
              {pending ? "Creating…" : "Create the key"}
            </button>
            <Message msg={msg} />
          </div>
        </form>
      ) : msg ? (
        <div className="mt-4">
          <Message msg={msg} />
        </div>
      ) : null}
    </>
  );
}

/** "Revoke" on a key row: confirm with an optional reason. */
export function RevokeKey({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();

  function revoke() {
    setMsg(null);
    start(async () => {
      const r = await revokeApiKey(id, reason);
      setMsg(r.ok ? { tone: "ok", text: r.message } : { tone: "error", text: r.error });
      if (r.ok) setOpen(false);
    });
  }

  return (
    <div className="flex flex-col items-start gap-2 md:items-end">
      <button
        type="button"
        className="text-link text-[14px]"
        aria-expanded={open}
        aria-controls={`revoke-${id}`}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Cancel" : "Revoke"}
      </button>
      {open ? (
        <div id={`revoke-${id}`} className="flex flex-wrap items-end gap-2.5">
          <div className="field-jn w-[220px]">
            <label htmlFor={`reason-${id}`}>Reason (optional)</label>
            <input
              id={`reason-${id}`}
              type="text"
              maxLength={200}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={pending}
            />
          </div>
          <button
            type="button"
            className="btn btn-sm text-danger"
            onClick={revoke}
            disabled={pending}
            aria-label={`Revoke ${name} now`}
          >
            {pending ? "Revoking…" : "Revoke now"}
          </button>
        </div>
      ) : null}
      <Message msg={msg} />
    </div>
  );
}
