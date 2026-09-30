import Image from "next/image";

export function DiscretionSplit() {
  return (
    <section className="container-jn section-jn-lg max-md:pt-16">
      <div className="grid grid-cols-1 items-center gap-16 md:grid-cols-2 max-md:gap-8">
        <div>
          <p className="eyebrow mb-5">Discretion</p>
          <blockquote className="title-section text-[clamp(32px,4vw,44px)] leading-[1.15]">
            Your journey stays invisible. Privacy isn&rsquo;t a feature&nbsp;&mdash;{" "}
            <em className="not-italic text-clearance">it&rsquo;s part of the product.</em>
          </blockquote>
        </div>
        <div className="relative aspect-[4/5] overflow-hidden rounded-card bg-surface-2">
          <Image
            src="/images/discretion/tail-night.webp"
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
          />
        </div>
      </div>
    </section>
  );
}
