"use client";

import { useEffect, useState } from "react";
import { Reveal } from "@/components/reveal";

const PRESS = ["Forbes", "Robb Report", "WSJ", "The Points Guy", "Aviation Week"];

const TESTIMONIALS = [
  {
    quote:
      '"Booked a one-way to Aspen at 4pm — wheels up by 7. JetNine’s dispatch knew the operator, the airframe, the captain. No surprises."',
    cite: "— M.K., Returning client · 12 sectors flown",
  },
  {
    quote:
      '"The quote came in under three minutes. The price held. The airframe held. Everything they said happened, happened — exactly."',
    cite: "— J.R., Family office · 24 sectors flown",
  },
  {
    quote:
      '"I needed a Phenom 300 in São Paulo on six hours’ notice. They had me on tarmac in five and a half. That’s the difference."',
    cite: "— A.D., Founder · 8 sectors flown",
  },
  {
    quote:
      '"What I wanted was a number to call and someone who already knew what I needed. JetNine is that number."',
    cite: "— S.L., Returning client · 31 sectors flown",
  },
];

export function PressAndTestimonials() {
  const [i, setI] = useState(0);
  const [fading, setFading] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      setFading(true);
      window.setTimeout(() => {
        setI((prev) => (prev + 1) % TESTIMONIALS.length);
        setFading(false);
      }, 320);
    }, 7000);
    return () => window.clearInterval(id);
  }, [paused]);

  function setIndex(next: number) {
    if (next === i) return;
    setFading(true);
    window.setTimeout(() => {
      setI(next);
      setFading(false);
    }, 320);
  }

  return (
    <section className="py-40 sm:py-24 lg:py-40">
      <div className="container-jn">
        {/* Press strip */}
        <Reveal className="flex flex-wrap items-center gap-x-12 gap-y-4 border-y border-ink-3 py-7">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-2">
            — As seen in
          </span>
          <div className="flex flex-wrap items-center gap-x-10 gap-y-3">
            {PRESS.map((mark) => (
              <span
                key={mark}
                className="font-serif text-[20px] font-normal leading-none text-bone opacity-70 transition-opacity hover:opacity-100"
              >
                {mark}
              </span>
            ))}
          </div>
        </Reveal>

        {/* Rotating testimonial */}
        <div
          className="mx-auto mt-32 max-w-[64ch] text-center"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <Reveal>
            <blockquote
              className="font-serif font-light leading-[1.25] tracking-tight text-bone transition-opacity duration-[320ms] ease-out-quint"
              style={{
                fontSize: "clamp(22px, 2.6vw, 32px)",
                opacity: fading ? 0 : 1,
              }}
            >
              {TESTIMONIALS[i].quote}
            </blockquote>
            <cite
              className="mt-7 block font-mono text-[11px] uppercase tracking-[0.12em] not-italic text-bone-2 transition-opacity duration-[320ms]"
              style={{ opacity: fading ? 0 : 1 }}
            >
              {TESTIMONIALS[i].cite}
            </cite>
          </Reveal>
          <div className="mt-10 flex justify-center gap-2.5" role="tablist" aria-label="Testimonial selector">
            {TESTIMONIALS.map((_, idx) => (
              <button
                key={idx}
                type="button"
                aria-label={`Quote ${idx + 1}`}
                aria-current={idx === i}
                onClick={() => setIndex(idx)}
                className={[
                  "h-1.5 w-1.5 rounded-full transition-colors",
                  idx === i ? "bg-clearance" : "bg-ink-3 hover:bg-bone-2",
                ].join(" ")}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
