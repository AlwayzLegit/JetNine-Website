"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChatTurnstileField, type ChatTurnstile } from "./chat-turnstile";
import { FIRST_LINE } from "@/lib/chat/copy";
import { seedQuote, type QuoteStart } from "@/lib/start-quote";

// The site chat's panel (OPS-242). The conversation lives in this component's state and
// nowhere else: closing the panel or leaving the page ends it, and no text is stored.
// On a fallback it shows one line and the two ordinary ways in, never an error.

type Msg = { role: "user" | "assistant"; content: string; quote?: QuoteStart };

const REDACTED = "[personal details removed]";

const MAX = 600;

export default function ChatPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const turnstile = useRef<ChatTurnstile | null>(null);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, []);
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [msgs, busy, fallback]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: text }];
    setMsgs(next);
    setDraft("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
          token: turnstile.current?.token() ?? undefined,
        }),
      });
      if (res.status === 403) {
        // The check had not finished (or the token was refused): give the visitor their text back to send again.
        turnstile.current?.reset();
        setMsgs(msgs);
        setDraft(text);
        setNotice("Please wait a moment for the security check to finish, then send again.");
        return;
      }
      setNotice(null);
      const j = (await res.json().catch(() => null)) as { text?: string; quote?: QuoteStart; fallback?: boolean; guard?: string } | null;
      if (!res.ok || !j || j.fallback || typeof j.text !== "string") {
        setFallback(true);
      } else {
        // A message that held personal details is blanked here too; the server never sends it on.
        const shown = j.guard === "personal" ? [...next.slice(0, -1), { role: "user" as const, content: REDACTED }] : next;
        setMsgs([...shown, { role: "assistant", content: j.text, quote: j.quote }]);
      }
    } catch {
      setFallback(true);
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  }

  function continueToQuote(q: QuoteStart) {
    // Counted as a hand-off; the visitor still finishes and sends the existing form.
    void fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: "handoff" }), keepalive: true }).catch(() => {});
    seedQuote(q);
    onClose();
    router.push("/quote/mission");
  }

  return (
    <section
      role="dialog"
      aria-label="Ask a question"
      className="fixed bottom-4 right-4 z-40 flex max-h-[min(560px,calc(100dvh-2rem))] w-[min(380px,calc(100vw-2rem))] flex-col rounded-card border border-line bg-surface shadow-xl"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="text-[15px] font-bold">Ask a question</h2>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control text-[14px] focus:outline-none focus-visible:ring-2 focus-visible:ring-clearance"
          aria-label="Close the chat"
        >
          <span aria-hidden>×</span>
        </button>
      </header>
      <div ref={log} role="log" aria-live="polite" aria-relevant="additions" className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-[14px]">
        <p className="rounded-control bg-surface-2 px-3 py-2 text-[13px] text-steel">{FIRST_LINE}</p>
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : ""}>
            <p className={`inline-block max-w-[92%] whitespace-pre-wrap rounded-control px-3 py-2 text-left ${m.role === "user" ? "bg-navy text-navy-on" : "bg-surface-2"}`}>
              <span className="sr-only">{m.role === "user" ? "You: " : "Assistant: "}</span>
              {m.content}
            </p>
            {m.quote && (
              <button
                type="button"
                onClick={() => continueToQuote(m.quote as QuoteStart)}
                className="mt-2 inline-flex min-h-[44px] items-center rounded-control bg-clearance px-4 text-[14px] font-bold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-clearance focus-visible:ring-offset-2"
              >
                Continue to your quote
              </button>
            )}
          </div>
        ))}
        {busy && <p className="text-[13px] text-steel">Writing an answer…</p>}
        {notice && <p className="text-[13px] text-steel">{notice}</p>}
        {fallback && (
          <p className="rounded-control bg-surface-2 px-3 py-2">
            The assistant is not available right now. You can <Link href="/contact" className="underline">contact dispatch</Link> or{" "}
            <Link href="/quote/mission" className="underline">start a quote</Link>.
          </p>
        )}
      </div>
      <form onSubmit={send} className="border-t border-line p-3">
        <label htmlFor="chat-input" className="sr-only">
          Your question
        </label>
        <textarea
          id="chat-input"
          ref={input}
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX))}
          maxLength={MAX}
          rows={2}
          disabled={fallback}
          className="w-full resize-none rounded-control border border-line bg-surface px-3 py-2 text-[14px] focus:outline-none focus-visible:ring-2 focus-visible:ring-clearance"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <ChatTurnstileField handle={turnstile} className="mt-2" />
        <button
          type="submit"
          disabled={busy || fallback || !draft.trim()}
          className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center rounded-control bg-navy px-4 text-[14px] font-bold text-navy-on disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-clearance focus-visible:ring-offset-2"
        >
          Send
        </button>
      </form>
    </section>
  );
}
