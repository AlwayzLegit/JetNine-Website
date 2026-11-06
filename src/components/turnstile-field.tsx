"use client";

import { useEffect, useRef } from "react";

// Cloudflare Turnstile widget for the public forms. Renders nothing unless
// NEXT_PUBLIC_TURNSTILE_SITE_KEY is set (see src/lib/turnstile.ts).
//
// "interaction-only": the widget stays invisible for almost everyone and
// shows a checkbox only when Cloudflare wants one.
//
// The forms build their own payloads (a hand-assembled FormData, or the
// quote draft object), so the token is read with getTurnstileToken() at
// submit time and not from a hidden input.

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId?: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let token: string | null = null;
let widgetId: string | null = null;
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Turnstile script failed to load"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/** The current token, or null when the widget is off or has not solved yet. */
export function getTurnstileToken(): string | null {
  return token;
}

/** A token is single-use: call after any submission that did not succeed. */
export function resetTurnstile(): void {
  token = null;
  if (widgetId && window.turnstile) window.turnstile.reset(widgetId);
}

export function TurnstileField({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!SITE_KEY || !ref.current) return;
    const el = ref.current;
    let cancelled = false;
    let mine: string | null = null;

    loadScript()
      .then(() => {
        if (cancelled || !window.turnstile) return;
        mine = window.turnstile.render(el, {
          sitekey: SITE_KEY,
          appearance: "interaction-only",
          "response-field": false,
          callback: (value: string) => {
            token = value;
          },
          "expired-callback": () => {
            token = null;
          },
          "error-callback": () => {
            token = null;
          },
        });
        widgetId = mine;
      })
      .catch((error) => console.error(error));

    return () => {
      cancelled = true;
      if (mine && window.turnstile) window.turnstile.remove(mine);
      if (widgetId === mine) {
        widgetId = null;
        token = null;
      }
    };
  }, []);

  if (!SITE_KEY) return null;
  return <div ref={ref} className={className} />;
}
