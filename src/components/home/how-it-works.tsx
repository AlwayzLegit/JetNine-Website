"use client";

import { useEffect, useRef, useState } from "react";
import { Reveal } from "@/components/reveal";

const STEPS = [
  {
    num: "01",
    title: "Request",
    body: "Tell us where, when, and how many. Sixty-second form, or call dispatch direct.",
  },
  {
    num: "02",
    title: "Match",
    body: "We surface three to five vetted aircraft within minutes — with all-in pricing.",
  },
  {
    num: "03",
    title: "Fly",
    body: "Show up. We handle catering, ground, customs, crew. You board.",
  },
];

export function HowItWorks() {
  const lineRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const node = lineRef.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setActive(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="pb-40 sm:pb-24 lg:pb-40">
      <div className="container-jn">
        <div className="mb-20 grid items-end gap-16 lg:grid-cols-[1fr_1.6fr]">
          <Reveal>
            <p className="caption">— The flow</p>
          </Reveal>
          <Reveal as="h2" stagger={1} className="display-m max-w-[20ch]">
            From request
            <br />
            to wheels-up.
          </Reveal>
        </div>

        <div className="relative">
          <div
            ref={lineRef}
            className="absolute inset-x-0 top-12 hidden h-px bg-ink-3 md:block"
          >
            <div
              className="absolute top-0 h-px bg-clearance transition-[width] duration-[1400ms] ease-out-quint"
              style={{ width: active ? "100%" : "0%" }}
            />
            <div
              className="absolute -top-[3px] h-[7px] w-[7px] rounded-full bg-clearance transition-[left] duration-[1400ms] ease-out-quint"
              style={{ left: active ? "calc(100% - 7px)" : "0px" }}
            />
          </div>

          <div className="grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-8">
            {STEPS.map((s, i) => (
              <Reveal
                key={s.num}
                stagger={(i as 0 | 1 | 2)}
                className="relative"
              >
                <div className="mb-6 flex h-24 items-start">
                  <span
                    className="font-mono text-[96px] font-light leading-none text-clearance"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    {s.num}
                  </span>
                </div>
                <h3 className="font-serif text-[28px] font-normal leading-[1.2] tracking-tight text-bone">
                  {s.title}
                </h3>
                <p className="mt-3 max-w-[36ch] text-[16px] leading-[1.6] text-bone-2">{s.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
