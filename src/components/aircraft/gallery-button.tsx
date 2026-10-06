"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import { LightWindow } from "@/components/light/window";

export type GalleryImage = { src: string; label: string };

/**
 * Cabin gallery window (JNM "gallery" / JNP "gallery"): one large slide
 * with previous / next, labelled thumbnails, arrow keys. `children` is the
 * trigger's content; the trigger itself is a plain button.
 */
export function GalleryButton({
  images,
  start = 0,
  title = "A closer look at the cabin",
  sub = "Explore the cabin and features that make the trip more comfortable.",
  note = "Illustrative imagery · Request photos of the quoted aircraft.",
  ariaLabel,
  className = "",
  aside,
  children,
}: {
  images: GalleryImage[];
  start?: number;
  title?: string;
  sub?: string;
  note?: string;
  ariaLabel?: string;
  className?: string;
  /** Optional panel beside the slides (the model window's "What to confirm"). */
  aside?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(start);
  const n = images.length;
  const cur = images[((i % n) + n) % n];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setI((v) => v - 1);
      if (e.key === "ArrowRight") setI((v) => v + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => {
          setI(start);
          setOpen(true);
        }}
        className={`cursor-pointer ${className}`}
      >
        {children}
      </button>
      <LightWindow open={open} onClose={() => setOpen(false)} width={860} title={title} sub={sub}>
        <div className={`mt-4 grid items-start gap-[18px] ${aside ? "[grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]" : ""}`}>
          <div className="min-w-0">
            <div className="relative aspect-[16/9] overflow-hidden rounded-[3px] bg-surface-2">
              <Image src={cur.src} alt={cur.label} fill sizes="(max-width: 700px) 100vw, 600px" className="object-cover" />
              <button
                type="button"
                aria-label="Previous image"
                onClick={() => setI((v) => v - 1)}
                className="absolute left-3 top-1/2 h-[34px] w-[34px] -translate-y-1/2 rounded-full bg-clearance text-[16px] text-white"
              >
                ←
              </button>
              <button
                type="button"
                aria-label="Next image"
                onClick={() => setI((v) => v + 1)}
                className="absolute right-3 top-1/2 h-[34px] w-[34px] -translate-y-1/2 rounded-full bg-clearance text-[16px] text-white"
              >
                →
              </button>
            </div>
            <p className="mt-2 font-serif text-[13px] text-steel">
              {note} · {((i % n) + n) % n + 1} of {n}
            </p>
            <div className="mt-3 grid gap-3" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
              {images.map((t, j) => {
                const on = j === ((i % n) + n) % n;
                return (
                  <button
                    key={t.src + j}
                    type="button"
                    aria-label={`Show ${t.label}`}
                    aria-pressed={on}
                    onClick={() => setI(j)}
                    className={`border-2 bg-transparent p-0 text-center ${on ? "border-gold" : "border-transparent"}`}
                  >
                    <span className="relative block aspect-[16/10] overflow-hidden bg-surface-2">
                      <Image src={t.src} alt="" fill sizes="140px" className="object-cover" />
                    </span>
                    <span className="block px-0.5 pb-1 pt-1.5 font-serif text-[13px] leading-[1.2] text-bone">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {aside}
        </div>
      </LightWindow>
    </>
  );
}
