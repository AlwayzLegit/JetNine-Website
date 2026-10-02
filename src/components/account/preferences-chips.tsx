"use client";

import { useState } from "react";

export type ChipOption = { id: string; label: string; desc?: string };

type Props = {
  /** Form field name; the selected option's id is submitted. */
  name: string;
  label: string;
  options: ChipOption[];
  defaultValue: string;
};

/**
 * One-of-many choice as `.chip`s (8px apart), with the selected option's
 * description as a sentence underneath. A hidden input carries the value
 * so the existing FormData-based actions read it exactly as before.
 */
export function PreferencesChips({ name, label, options, defaultValue }: Props) {
  const [value, setValue] = useState(defaultValue);
  const selected = options.find((o) => o.id === value);
  return (
    <div>
      <div className="mb-2 text-[13px] text-bone-2">{label}</div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={value === o.id}
            onClick={() => setValue(o.id)}
            className="chip"
          >
            {o.label}
          </button>
        ))}
      </div>
      {selected?.desc ? <p className="mt-2 text-[14px] text-steel">{selected.desc}</p> : null}
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
