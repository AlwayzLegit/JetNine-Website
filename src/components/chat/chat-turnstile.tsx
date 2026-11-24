"use client";

import { useEffect, useRef } from "react";

// The chat's own Cloudflare Turnstile widget (OPS-242). The shared TurnstileField keeps one token and one
// widget id in module variables for the whole page, so a second widget (the chat on /contact, next to the
// contact form's) would overwrite and, on close, clear the form's. This one keeps its token and its widget
// id to itself and removes only its own widget. Renders nothing unless NEXT_PUBLIC_TURNSTILE_SITE_KEY is set.

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type Api = {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId?: string): void;
  remove(widgetId: string): void;
};
const api = () => (window as Window & { turnstile?: Api }).turnstile;

/** Waits for the Turnstile script: loads it if no tag for it is on the page yet, else waits for the other tag's script. */
function ready(): Promise<Api> {
  return new Promise((resolve, reject) => {
    if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
    const started = Date.now();
    const timer = window.setInterval(() => {
      const t = api();
      if (t) {
        window.clearInterval(timer);
        resolve(t);
      } else if (Date.now() - started > 15_000) {
        window.clearInterval(timer);
        reject(new Error("Turnstile script did not load"));
      }
    }, 100);
  });
}

export type ChatTurnstile = { token: () => string | null; reset: () => void };

export function ChatTurnstileField({ handle, className = "" }: { handle: React.MutableRefObject<ChatTurnstile | null>; className?: string }) {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!SITE_KEY || !el.current) return;
    const host = el.current;
    let cancelled = false;
    let widget: string | null = null;
    let token: string | null = null;
    handle.current = {
      token: () => token,
      reset: () => {
        token = null;
        if (widget) api()?.reset(widget);
      },
    };
    ready()
      .then((t) => {
        if (cancelled) return;
        widget = t.render(host, {
          sitekey: SITE_KEY,
          appearance: "interaction-only",
          "response-field": false,
          callback: (v: string) => {
            token = v;
          },
          "expired-callback": () => {
            token = null;
          },
          "error-callback": () => {
            token = null;
          },
        });
      })
      .catch((e) => console.error(e));
    return () => {
      cancelled = true;
      if (widget) api()?.remove(widget);
      handle.current = null;
    };
  }, [handle]);

  if (!SITE_KEY) return null;
  return <div ref={el} className={className} />;
}
