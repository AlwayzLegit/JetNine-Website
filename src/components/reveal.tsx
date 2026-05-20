"use client";

import { useEffect, useRef, type ElementType, type HTMLAttributes } from "react";

type RevealProps = {
  as?: ElementType;
  stagger?: 0 | 1 | 2 | 3 | 4 | 5;
  threshold?: number;
  className?: string;
  children: React.ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "children" | "className">;

export function Reveal({
  as,
  stagger = 0,
  threshold = 0.15,
  className = "",
  children,
  ...rest
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const Tag = (as ?? "div") as ElementType;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      node.classList.add("in");
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    <Tag
      ref={ref}
      data-stagger={stagger || undefined}
      className={`reveal ${className}`.trim()}
      {...rest}
    >
      {children}
    </Tag>
  );
}
