"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { SocialLinks, SocialPlatform } from "@/lib/social-links";
import { SocialIcon } from "@/components/social-icons";
import { saveSocialLinks } from "./actions";

type Msg = { tone: "ok" | "error"; text: string } | null;

export function SocialLinksForm({
  platforms,
  links,
}: {
  platforms: { key: SocialPlatform; label: string; placeholder: string }[];
  links: SocialLinks;
}) {
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setMsg(null);
    start(async () => {
      const r = await saveSocialLinks(data);
      setMsg(
        r.ok
          ? { tone: "ok", text: r.changed ? "Saved. The footer updates within a few seconds." : "No changes to save." }
          : { tone: "error", text: r.error },
      );
    });
  }

  return (
    <section className="card bg-panel p-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        {platforms.map((p) => (
          <div key={p.key} className="field-jn">
            <label htmlFor={`social-${p.key}`} className="!flex items-center gap-2">
              <SocialIcon platform={p.key} className="h-3.5 w-3.5 text-steel" />
              {p.label}
            </label>
            <input
              id={`social-${p.key}`}
              name={p.key}
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              defaultValue={links[p.key] ?? ""}
              placeholder={p.placeholder}
            />
          </div>
        ))}
        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
            {pending ? "Saving…" : "Save links"}
          </button>
          {msg ? (
            <p role="status" className={`text-[14px] ${msg.tone === "ok" ? "text-success" : "text-danger"}`}>
              {msg.text}
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}
