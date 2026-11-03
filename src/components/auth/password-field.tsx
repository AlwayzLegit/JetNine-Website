"use client";

import { useId, useRef, useState, type ComponentProps } from "react";

type Props = Omit<ComponentProps<"input">, "type" | "id" | "className"> & {
  id: string;
  label: string;
  /** Sentence under the control — a hint or the field's error. */
  hint?: React.ReactNode;
  error?: boolean;
};

/**
 * Password input with a show / hide toggle. The toggle is a real button
 * (`aria-pressed` tells screen readers its state), it never takes focus
 * away from the field — mousedown is cancelled and focus is put back after
 * the flip — and the eye icon flips with it.
 */
export function PasswordField({ id, label, hint, error, disabled, ...rest }: Props) {
  const [visible, setVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();

  function toggle() {
    setVisible((v) => !v);
    // Keep the caret where it was so a member can keep typing after a peek.
    const el = inputRef.current;
    if (el) {
      const { selectionStart, selectionEnd } = el;
      requestAnimationFrame(() => {
        el.focus();
        if (selectionStart != null && selectionEnd != null) {
          try {
            el.setSelectionRange(selectionStart, selectionEnd);
          } catch {
            // type=text/password both support it; ignore anything else.
          }
        }
      });
    }
  }

  return (
    <div className={`field-jn ${error ? "error" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type={visible ? "text" : "password"}
          disabled={disabled}
          aria-describedby={hint ? hintId : undefined}
          className="!pr-12"
          {...rest}
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={toggle}
          aria-pressed={visible}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-controls={id}
          disabled={disabled}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-steel transition-colors hover:text-bone focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-[-3px] focus-visible:outline-[#976727] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <EyeIcon off={visible} />
        </button>
      </div>
      {hint ? (
        <p id={hintId} className={`mt-1.5 text-[13px] leading-[1.45] ${error ? "text-danger" : "text-steel"}`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off ? <path d="M4 4l16 16" /> : null}
    </svg>
  );
}
