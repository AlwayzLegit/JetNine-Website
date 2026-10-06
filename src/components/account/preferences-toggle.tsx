"use client";

import { useId, useState } from "react";

type Props = {
  /** Form field name; submits "on" when checked, nothing when not. */
  name: string;
  label: string;
  desc?: string;
  defaultChecked: boolean;
};

/**
 * A yes/no preference as a pill (Light - Account "Preferences"): white
 * with a line border when off, navy fill when on, `aria-pressed` for
 * state. The description stays available to assistive tech and as a
 * tooltip. A hidden checkbox carries the value so the existing
 * FormData-based actions read it exactly as before.
 */
export function PreferencesToggle({ name, label, desc, defaultChecked }: Props) {
  const [on, setOn] = useState(defaultChecked);
  const id = useId();
  return (
    <>
      <button
        type="button"
        aria-pressed={on}
        aria-describedby={desc ? id : undefined}
        title={desc}
        onClick={() => setOn((v) => !v)}
        className={[
          "inline-flex min-h-[34px] items-center rounded-pill border px-3 text-left text-[13px] transition-colors",
          on ? "border-bone bg-clearance text-white" : "border-line bg-surface text-bone hover:border-steel",
        ].join(" ")}
      >
        {on ? <span aria-hidden="true" className="mr-1.5">✓</span> : null}
        {label}
      </button>
      {desc ? (
        <span id={id} className="sr-only">
          {desc}
        </span>
      ) : null}
      <input type="checkbox" name={name} checked={on} readOnly tabIndex={-1} aria-hidden className="sr-only" />
    </>
  );
}
