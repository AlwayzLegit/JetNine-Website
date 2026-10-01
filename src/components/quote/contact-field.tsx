import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

/**
 * Compact field from the quote prototype: a surface-2 box with the 13px
 * label sitting above a transparent 16px control. The label is a real
 * `<label for>` so the smoke test's `getByLabel("Phone", { exact: true })`
 * resolves. Focus is the 1px clearance ring on the box; an error swaps
 * it for danger and tints the label.
 */

function boxClass(error: boolean | undefined, className: string): string {
  return [
    "rounded-control bg-surface-2 px-[14px] py-[10px] transition-shadow",
    error
      ? "shadow-[0_0_0_1px_var(--danger)]"
      : "focus-within:shadow-[0_0_0_1px_var(--clearance)]",
    className,
  ].join(" ");
}

function FieldLabel({
  htmlFor,
  label,
  hint,
  error,
}: {
  htmlFor: string;
  label: string;
  hint?: string;
  error?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1 text-[13px] leading-[1.4]">
      <label htmlFor={htmlFor} className={error ? "text-danger" : "text-bone-2"}>
        {label}
      </label>
      {hint ? <span className="text-steel">{hint}</span> : null}
    </div>
  );
}

const CONTROL =
  "mt-1 block w-full bg-transparent text-[16px] leading-[1.4] text-bone outline-none placeholder:text-steel";

type FieldProps = {
  id: string;
  label: string;
  /** Small steel note after the label, e.g. "(optional)". Not part of the accessible name. */
  hint?: string;
  error?: boolean;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className">;

export function ContactField({ id, label, hint, error, className = "", ...input }: FieldProps) {
  return (
    <div className={boxClass(error, className)} data-error={error ? "true" : undefined}>
      <FieldLabel htmlFor={id} label={label} hint={hint} error={error} />
      <input id={id} aria-invalid={error || undefined} className={CONTROL} {...input} />
    </div>
  );
}

type SelectProps = {
  id: string;
  label: string;
  error?: boolean;
  className?: string;
  children: React.ReactNode;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "className" | "children">;

export function ContactSelectField({ id, label, error, className = "", children, ...select }: SelectProps) {
  return (
    <div className={boxClass(error, className)} data-error={error ? "true" : undefined}>
      <FieldLabel htmlFor={id} label={label} error={error} />
      <select id={id} className={CONTROL} style={{ colorScheme: "dark" }} {...select}>
        {children}
      </select>
    </div>
  );
}
