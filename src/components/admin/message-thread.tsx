"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Bubble } from "@/components/admin/messages/bubble";
import { channelWords, isTeamOnly, messageWhen } from "@/components/admin/messages/words";

/**
 * Composer channels. The enum values stay (sms, email, whatsapp, call,
 * inapp); the desk shows plain words. `needs` is the address a channel
 * has to have on file before it can be picked.
 */
const CHANNELS: {
  id: string;
  label: string;
  hint: string;
  placeholder: (first: string) => string;
  needs: "phone" | "email" | null;
}[] = [
  { id: "sms", label: "Text", hint: "Goes to the mobile on file", placeholder: (f) => `Text ${f}…`, needs: "phone" },
  { id: "email", label: "Email", hint: "Sent from dispatch@jetnine.com", placeholder: () => "Write an email…", needs: "email" },
  {
    id: "whatsapp",
    label: "WhatsApp",
    hint: "Goes to the WhatsApp number on file",
    placeholder: (f) => `Message ${f} on WhatsApp…`,
    needs: "phone",
  },
  { id: "call", label: "Call note", hint: "Logs a call you made or took", placeholder: () => "What was said on the call…", needs: null },
  { id: "inapp", label: "Internal note", hint: "Only the team can see notes", placeholder: () => "Add a note for the team…", needs: null },
];

const QUICK_REPLIES: { label: string; text: string }[] = [
  {
    label: "Options coming within 30 min",
    text: "Got your request — working on options now, you'll have them within 30 minutes.",
  },
  {
    label: "Aircraft is held for 24 h",
    text: "The aircraft is held for you for the next 24 hours. Let me know if you'd like to confirm.",
  },
  {
    label: "Where to go on the day",
    text: "On the day, head to the private terminal — the address and the crew contact are on your trip page.",
  },
  {
    label: "Deposit reminder",
    text: "A quick reminder that the deposit is due within 3 days to keep the aircraft held for you.",
  },
];

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

type PostResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Polymorphic thread renderer + composer. Drives the request page, the
 * trip page and Messages. The caller binds the subject id into `postAction`
 * so this component stays agnostic of subject_type.
 */
export function MessageThread({
  initial,
  defaultEmail,
  defaultPhone,
  postAction,
  compact = false,
  clientName,
  disabledNote,
}: {
  initial: ThreadMessage[];
  defaultEmail: string | null;
  defaultPhone: string | null;
  postAction: (formData: FormData) => Promise<PostResult>;
  /**
   * Kept for the existing callers; no longer rendered. The placeholder is
   * now per channel ("Text Dana…", "Write an email…").
   */
  composerHint?: string;
  /** Narrow column (Requests): smaller paddings, no quick replies. */
  compact?: boolean;
  /** "Dana Whitfield" — first name goes into "Text Dana…". */
  clientName?: string | null;
  /** When set, the composer renders disabled with this sentence. */
  disabledNote?: string;
}) {
  const firstName = (clientName ?? "").trim().split(" ")[0] || "the client";
  const canUse = (id: string) => {
    const c = CHANNELS.find((x) => x.id === id);
    if (!c) return false;
    if (c.needs === "phone") return Boolean(defaultPhone);
    if (c.needs === "email") return Boolean(defaultEmail);
    return true;
  };
  const firstUsable = CHANNELS.find((c) => canUse(c.id))?.id ?? "inapp";

  const [list, setList] = useState<ThreadMessage[]>(initial);
  const [channel, setChannel] = useState<string>(firstUsable);
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const current = CHANNELS.find((c) => c.id === channel) ?? CHANNELS[0];
  const addressDefault =
    current.needs === "email" ? defaultEmail ?? "" : current.needs === "phone" ? defaultPhone ?? "" : "";
  const now = new Date();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (disabledNote) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    setMsg(null);

    startTransition(async () => {
      const result = await postAction(data);
      if (result.ok) {
        const text = ((data.get("body") as string) ?? "").trim();
        const preview = text.length > 140 ? `${text.slice(0, 139)}…` : text;
        const toAddress = addressDefault || null;
        // Optimistic status — the server has already posted; the next
        // render brings the real delivery_status. Transmitting channels
        // show as queued until then, the rest as skipped (logged only).
        const optimisticStatus: DeliveryStatus =
          (channel === "email" || channel === "sms" || channel === "whatsapp") && toAddress ? "queued" : "skipped";
        setList((prev) => [
          ...prev,
          {
            id: result.id,
            channel,
            direction: "out",
            fromLabel: "You",
            toAddress,
            preview,
            body: text,
            occurredAt: new Date(),
            deliveryStatus: optimisticStatus,
          },
        ]);
        setMsg({ tone: "ok", text: channel === "inapp" || channel === "call" ? "Saved." : "Sent." });
        setBody("");
      } else {
        setMsg({ tone: "error", text: humanError(result.error) });
      }
    });
  }

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${compact ? "gap-4" : "gap-5"}`}>
      {/* Bubbles */}
      <div className={`flex flex-col ${compact ? "gap-3" : "gap-3.5"}`}>
        {list.length === 0 ? (
          <p className="rounded-card border border-dashed border-line-2 bg-surface px-5 py-6 text-center text-[15px] text-bone-2">
            No messages yet. The first one starts the thread.
          </p>
        ) : (
          list.map((m) => {
            const note = isTeamOnly(m.channel, m.direction);
            const kind = note ? "note" : m.direction === "out" ? "out" : "in";
            const who =
              m.channel === "system"
                ? "System"
                : m.direction === "out"
                  ? firstWord(m.fromLabel) ?? "You"
                  : firstWord(m.fromLabel) ?? firstName;
            const meta = [who, channelWords(m.channel), messageWhen(m.occurredAt, now)].filter(Boolean).join(" · ");
            const failed = m.direction === "out" && m.deliveryStatus === "failed";
            const loggedOnly =
              m.direction === "out" && m.deliveryStatus === "queued" && m.deliveryProvider === "logger";
            const footer = failed ? (
              <div className="mt-1 text-[13px] text-danger">
                Didn&rsquo;t send{m.deliveryError ? ` · ${m.deliveryError}` : ""}
              </div>
            ) : loggedOnly ? (
              <div className="mt-1 text-[13px] text-steel">Logged only — the channel isn&rsquo;t connected yet.</div>
            ) : null;
            return (
              <Bubble key={m.id} kind={kind} meta={meta} footer={footer} compact={compact}>
                {m.body ?? m.preview ?? ""}
              </Bubble>
            );
          })
        )}
      </div>

      {/* Composer */}
      <form onSubmit={onSubmit} className={`mt-auto border-t border-line-faint ${compact ? "pt-4" : "pt-5"}`}>
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
          {CHANNELS.map((c) => {
            const usable = canUse(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={channel === c.id}
                disabled={!usable || Boolean(disabledNote)}
                title={
                  !usable ? (c.needs === "phone" ? "No mobile on file" : "No email on file") : undefined
                }
                onClick={() => setChannel(c.id)}
                className="chip chip-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                {c.label}
              </button>
            );
          })}
          <span className="ml-auto text-[13px] text-steel">{disabledNote ?? current.hint}</span>
        </div>
        <input type="hidden" name="channel" value={channel} />
        <div className={`grid gap-2.5 ${compact ? "grid-cols-1" : "grid-cols-[minmax(0,1fr)_auto] items-end"}`}>
          <textarea
            name="body"
            rows={compact ? 3 : 2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={disabledNote ? "" : current.placeholder(firstName)}
            aria-label="Message"
            required
            maxLength={4000}
            disabled={Boolean(disabledNote)}
            className="w-full resize-none rounded-[10px] border border-line bg-surface px-3.5 py-3 text-[15px] leading-[1.5] text-bone outline-none placeholder:text-steel focus:border-steel disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={pending || Boolean(disabledNote)}
            className={`btn btn-primary ${compact ? "btn-sm justify-self-end" : "h-12 px-5"}`}
          >
            {pending ? "Sending…" : "Send"}
          </button>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {!compact && !disabledNote ? (
            <>
              <span className="text-[13px] text-steel">Quick replies:</span>
              {QUICK_REPLIES.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => setBody(q.text.replace("the client", firstName))}
                  className="chip chip-sm"
                >
                  {q.label}
                </button>
              ))}
            </>
          ) : null}
          {msg ? (
            <span
              role="status"
              className={`ml-auto text-[13px] ${msg.tone === "error" ? "text-danger" : "text-success"}`}
            >
              {msg.text}
            </span>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function firstWord(s: string | null | undefined): string | null {
  if (!s) return null;
  const w = s.trim().split(/\s+/)[0];
  return w || null;
}

function humanError(code: string): string {
  switch (code) {
    case "DB_INSERT_FAILED":
      return "Couldn't save the message. Try again.";
    case "Body required":
      return "Write something first.";
    default:
      return code.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
  }
}
