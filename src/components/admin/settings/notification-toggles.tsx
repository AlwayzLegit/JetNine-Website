"use client";

import { useEffect, useState, useTransition } from "react";
import { saveNotificationPref } from "@/app/admin/settings/notifications/actions";

export type NotificationToggleItem = {
  key: string;
  title: string;
  desc: string;
  on: boolean;
};

/**
 * The four notification rows. Each row is one switch (`.switch`,
 * `aria-checked`); flipping it saves straight away through a server
 * action and shows "Saved" in 13px steel.
 */
export function NotificationToggles({ items }: { items: NotificationToggleItem[] }) {
  const [state, setState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((i) => [i.key, i.on])),
  );
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(null), 2500);
    return () => clearTimeout(t);
  }, [saved]);

  function flip(key: string) {
    const next = !state[key];
    const previous = state[key];
    setState((s) => ({ ...s, [key]: next }));
    setError(null);
    setSaved(null);
    start(async () => {
      const r = await saveNotificationPref(key, next);
      if (r.ok) {
        setSaved(key);
      } else {
        setState((s) => ({ ...s, [key]: previous }));
        setError(r.error);
      }
    });
  }

  return (
    <div className="card overflow-hidden">
      {items.map((i) => {
        const on = state[i.key];
        const labelId = `notify-${i.key}`;
        return (
          <div
            key={i.key}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-6 border-b border-line-faint px-6 py-4 last:border-b-0"
          >
            <div className="min-w-0">
              <div id={labelId} className="text-[16px] font-medium text-bone">
                {i.title}
              </div>
              <div className="text-[14px] text-steel">{i.desc}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-steel" aria-live="polite">
                {saved === i.key ? "Saved" : ""}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-labelledby={labelId}
                className="switch"
                disabled={pending}
                onClick={() => flip(i.key)}
              />
            </div>
          </div>
        );
      })}
      {error ? <p className="border-t border-line-faint px-6 py-3 text-[14px] text-danger">{error}</p> : null}
    </div>
  );
}
