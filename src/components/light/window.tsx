"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The light handoff's "window" (jn-light-chrome.js `JN.open`): a native
 * <dialog> shown as a centred modal or a right-edge drawer, with Escape,
 * backdrop click and focus restoration handled by the browser. Content is
 * passed as children, so it can be server-rendered and stays in the HTML.
 *
 *   <WindowButton label="Read the sources ↗" title="Sources" variant="drawer">
 *     …content…
 *   </WindowButton>
 */
export function LightWindow({
  open,
  onClose,
  title,
  sub,
  variant = "modal",
  width = 640,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  sub?: ReactNode;
  variant?: "modal" | "drawer";
  /** Modal width in px (default 640); galleries and comparisons go wider. */
  width?: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // Clicks on the backdrop land on the <dialog> element itself.
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose();
      }}
      style={variant === "modal" ? { width: `min(${width}px, calc(100% - 32px))` } : undefined}
      className={[
        "light-window m-0 max-h-none max-w-none border-0 bg-white p-0 text-[15px] leading-[1.5] text-bone backdrop:bg-[rgba(9,24,34,0.52)]",
        variant === "drawer"
          ? "ml-auto h-dvh w-[min(440px,100%)] shadow-[-20px_0_60px_rgba(9,24,34,0.25)]"
          : "mx-auto my-12 max-h-[calc(100dvh-96px)] overflow-auto rounded-[4px] shadow-[0_20px_80px_rgba(0,0,0,0.22)]",
      ].join(" ")}
    >
      {open ? (
        <div className={variant === "drawer" ? "relative min-h-full px-[clamp(16px,4vw,32px)] pb-8 pt-11" : "relative px-9 pb-[30px] pt-[34px] max-sm:px-5"}>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-[14px] top-[10px] border-0 bg-transparent px-2 py-1 text-[28px] leading-none text-bone"
          >
            ×
          </button>
          {title ? <h2 className="title-app !text-[31px] !leading-[1.12]">{title}</h2> : null}
          {sub ? <p className="mt-[6px] text-[15px] text-steel">{sub}</p> : null}
          {children}
        </div>
      ) : null}
    </dialog>
  );
}

/** A button that opens a LightWindow. `className` styles the trigger. */
export function WindowButton({
  label,
  className = "rule-link",
  title,
  sub,
  variant,
  width,
  children,
}: {
  label: ReactNode;
  className?: string;
  title?: ReactNode;
  sub?: ReactNode;
  variant?: "modal" | "drawer";
  width?: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`cursor-pointer ${className}`} onClick={() => setOpen(true)}>
        {label}
      </button>
      <LightWindow open={open} onClose={() => setOpen(false)} title={title} sub={sub} variant={variant} width={width}>
        {children}
      </LightWindow>
    </>
  );
}
