import { Reveal } from "@/components/reveal";
import { Placeholder } from "@/components/placeholder";

export function DiscretionSplit() {
  return (
    <section className="border-y border-ink-3 py-40 sm:py-24 lg:py-40">
      <div className="container-jn">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-2">
          <div>
            <Reveal>
              <p className="caption mb-8">— Discretion</p>
            </Reveal>
            <Reveal as="blockquote" stagger={1} className="font-serif font-light leading-[1.15] tracking-tight text-bone" style={{ fontSize: "clamp(32px, 4.5vw, 48px)" }}>
              Your journey stays invisible. Privacy isn&rsquo;t a feature&nbsp;&mdash;{" "}
              <em className="not-italic text-clearance">it&rsquo;s part of the product.</em>
            </Reveal>
          </div>
          <Reveal stagger={1}>
            <Placeholder caption="— TAIL, NIGHT TARMAC" aspect="4/5" />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
