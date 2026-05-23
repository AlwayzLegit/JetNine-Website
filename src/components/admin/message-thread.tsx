"use client";

import { useState, useTransition, type FormEvent } from "react";

const CHANNELS = [
  { id: "inapp", label: "In-app", desc: "Member-portal message." },
  { id: "email", label: "Email", desc: "Sends via the configured provider." },
  { id: "sms", label: "SMS", desc: "Sends via Twilio." },
  { id: "call", label: "Call note", desc: "Phone-call summary." },
  { id: "voicemail", label: "Voicemail", desc: "Left a voicemail." },
] as const;

export type DeliveryStatus = "queued" | "sent" | "failed" | "skipped";

export type ThreadMessage = {
  id: string;
  channel: string;
  direction: "in" | "out";
  fromLabel: string | null;
  toAddress: string | null;
  preview: string | null;
  body: string | null;
  occurredAt: Date | null;
  deliveryStatus?: DeliveryStatus | null;
  deliveryProvider?: string | null;
  deliveryError?: string | null;
};

const DELIVERY_PILL_CLASS: Record<DeliveryStatus, string> = {
  sent: "border-[var(--success)] text-[var(--success)]",
  queued: "border-[var(--warn)] text-[var(--warn)]",
  failed: "border-[var(--error)] text-[var(--error)]",
  skipped: "border-ink-3 text-steel",
};

type PostResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Polymorphic thread renderer + composer. Drives both the quote workbench
 * and trip sheet messaging surfaces. The caller binds the subject id into
 * `postAction` so this component stays agnostic of subject_type.
 */
export function MessageThread({
  initial,
  defaultEmail,
  defaultPhone,
  postAction,
  composerHint,
}: {
  initial: ThreadMessage[];
  defaultEmail: string | null;
  defaultPhone: string | null;
  postAction: (formData: FormData) => Promise<PostResult>;
  composerHint?: string;
}) {
  const [list, setList] = useState<ThreadMessage[]>(initial);
  const [channel, setChannel] = useState<string>("inapp");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const needsAddress =
    channel === "email" || channel === "sms" || channel === "call" || channel === "voicemail";
  const addressDefault =
    channel === "email"
      ? defaultEmail ?? ""
      : channel === "sms" || channel === "call" || channel === "voicemail"
        ? defaultPhone ?? ""
        : "";

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setMsg(null);

    startTransition(async () => {
      const result = await postAction(data);
      if (result.ok) {
        const body = (data.get("body") as string) ?? "";
        const preview = body.length > 140 ? `${body.slice(0, 139)}…` : body;
        const toAddress =
          ((data.get("toAddress") as string) ?? "").trim() || addressDefault || null;
        // Optimistic status — the server-side post has already happened
        // by the time we get here; revalidatePath will refresh with the
        // real delivery_status on the next render, but until then we
        // mark email as 'queued' (in-flight from the user's POV) and
        // everything else as 'skipped' to match server behaviour.
        const optimisticStatus: DeliveryStatus =
          (channel === "email" || channel === "sms") && toAddress ? "queued" : "skipped";
        const optimistic: ThreadMessage = {
          id: result.id,
          channel,
          direction: "out",
          fromLabel: "You",
          toAddress,
          preview,
          body,
          occurredAt: new Date(),
          deliveryStatus: optimisticStatus,
        };
        setList((prev) => [...prev, optimistic]);
        setMsg({ tone: "ok", text: "POSTED — thread updated." });
        form.reset();
        setChannel("inapp");
      } else {
        setMsg({ tone: "error", text: `BLOCKED — ${result.error.toUpperCase()}` });
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {list.length === 0 ? (
        <p className="rounded-[2px] border border-dashed border-ink-3 bg-ink p-5 font-mono text-[10px] uppercase tracking-[0.1em] text-bone-2">
          — No thread yet. First message starts the audit trail.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((m) => (
            <li
              key={m.id}
              className={[
                "rounded-[3px] border p-4",
                m.direction === "out"
                  ? "border-ink-3 bg-ink"
                  : "border-l-2 border-l-clearance border-ink-3 bg-ink-2",
              ].join(" ")}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-clearance">
                    — {m.channel.toUpperCase()} · {m.direction === "out" ? "OUTBOUND" : "INBOUND"}
                  </span>
                  {m.direction === "out" && m.deliveryStatus ? (
                    <span
                      title={m.deliveryError ?? m.deliveryProvider ?? undefined}
                      className={[
                        "inline-block rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]",
                        DELIVERY_PILL_CLASS[m.deliveryStatus],
                      ].join(" ")}
                    >
                      {m.deliveryStatus}
                    </span>
                  ) : null}
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
                  {m.occurredAt
                    ? m.occurredAt.toISOString().slice(0, 16).replace("T", " ") + " UTC"
                    : "—"}
                </span>
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-bone-2">
                {m.direction === "out" ? "TO" : "FROM"}:{" "}
                <span className="text-bone">{m.toAddress ?? m.fromLabel ?? "—"}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-[13px] leading-[1.55] text-bone">
                {m.body ?? m.preview ?? ""}
              </p>
              {m.direction === "out" && m.deliveryStatus === "failed" && m.deliveryError ? (
                <p className="mt-2 font-mono text-[10px] leading-[1.4] text-[var(--error)]">
                  delivery error: {m.deliveryError}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onSubmit} className="rounded-[3px] border border-ink-3 bg-ink p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[200px_1fr]">
          <div className="field-jn">
            <label htmlFor="mt-channel">Channel</label>
            <select
              id="mt-channel"
              name="channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              required
            >
              {CHANNELS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} — {c.desc}
                </option>
              ))}
            </select>
          </div>
          {needsAddress ? (
            <div className="field-jn">
              <label htmlFor="mt-toAddress">
                {channel === "email" ? "To · email" : "To · phone"}
              </label>
              <input
                id="mt-toAddress"
                name="toAddress"
                type="text"
                placeholder={addressDefault || "—"}
                defaultValue={addressDefault}
              />
            </div>
          ) : (
            <div className="flex items-center rounded-[2px] border border-dashed border-ink-3 bg-ink-2 px-4 font-mono text-[10px] uppercase tracking-[0.1em] text-steel">
              — Routes to member&rsquo;s portal inbox.
            </div>
          )}
        </div>
        <div className="field-jn mt-3">
          <label htmlFor="mt-body">Message</label>
          <textarea
            id="mt-body"
            name="body"
            rows={4}
            placeholder={composerHint ?? "Type a message…"}
            required
            maxLength={4000}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {msg ? (
            <span
              className={[
                "font-mono text-[11px] uppercase tracking-[0.12em]",
                msg.tone === "error" ? "text-[var(--error)]" : "text-[var(--success)]",
              ].join(" ")}
            >
              {msg.text}
            </span>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
              — Logged + audit-tracked. Email + SMS deliver via the configured providers; failed sends surface on /admin/dispatch.
            </span>
          )}
          <button
            type="submit"
            disabled={pending}
            className="btn btn-primary btn-sm disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? "Posting…" : "Post message"} <span className="arrow">→</span>
          </button>
        </div>
      </form>
    </div>
  );
}
