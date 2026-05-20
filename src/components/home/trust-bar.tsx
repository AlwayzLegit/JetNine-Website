"use client";

import { useEffect, useRef, useState } from "react";
import { TRUST_BAR, type TrustBarItem } from "@/lib/constants";

function easeOutQuart(t: number) {
  return 1 - Math.pow(1 - t, 4);
}

function useCountUp(target: number, run: boolean, duration = 1200) {
  const [value, setValue] = useState(run ? target : 0);
  useEffect(() => {
    if (!run) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setValue(Math.round(easeOutQuart(t) * target));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [run, target, duration]);
  return value;
}

function TrustItem({ item, run }: { item: TrustBarItem; run: boolean }) {
  const isNumeric = "value" in item;
  const animated = useCountUp(isNumeric ? item.value : 0, run && isNumeric);
  const display = isNumeric
    ? `${animated.toLocaleString()}${item.suffix ?? ""}`
    : item.static;

  return (
    <div className="flex flex-1 flex-col gap-1.5 border-r border-ink-3 px-6 last:border-r-0 min-w-[160px]">
      <span
        className="font-serif text-[32px] font-light leading-none tracking-tight text-bone"
        style={{ fontVariationSettings: '"opsz" 72' }}
      >
        {display}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-2">
        {item.label}
      </span>
    </div>
  );
}

export function TrustBar() {
  const ref = useRef<HTMLElement | null>(null);
  const [run, setRun] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setRun(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRun(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className="mt-20 border-y border-ink-3 bg-ink-2 py-9"
      aria-label="Trust indicators"
    >
      <div className="container-jn flex flex-wrap items-center">
        {TRUST_BAR.map((item) => (
          <TrustItem key={item.label} item={item} run={run} />
        ))}
      </div>
    </section>
  );
}
