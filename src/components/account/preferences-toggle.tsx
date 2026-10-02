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
 * A `.switch` row for forms: label and description on the left, the
 * 36×20 switch on the right. The visible control is a button with
 * `role="switch"` + `aria-checked`; a hidden checkbox carries the value
 * so the existing FormData-based actions read it exactly as before.
 */
export function PreferencesToggle({ name, label, desc, defaultChecked }: Props) {
  const [on, setOn] = useState(defaultChecked);
  const id = useId();
  return (
    <div className="flex min-h-[44px] items-center justify-between gap-4 py-1">
      <div className="min-w-0">
        <div id={id} className="text-[15px] text-bone">
          {label}
        </div>
        {desc ? <div className="mt-0.5 text-[13px] leading-[1.45] text-steel">{desc}</div> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={id}
        onClick={() => setOn((v) => !v)}
        className="switch focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clearance"
      />
      <input type="checkbox" name={name} checked={on} readOnly tabIndex={-1} aria-hidden className="sr-only" />
    </div>
  );
}
