import { Reveal } from "@/components/reveal";

type Props = {
  kicker: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
};

/**
 * Shared marketing-page header. Sits below the fixed nav and provides
 * a consistent intro band: small dash + kicker, display-xl headline,
 * optional lead paragraph. Used by /aircraft, /memberships,
 * /empty-legs, /about, etc.
 */
export function PageHeader({ kicker, title, lead }: Props) {
  return (
    <header className="border-b border-ink-3 bg-ink pt-[200px] pb-24 max-md:pt-[140px] max-md:pb-16">
      <div className="container-jn">
        <Reveal className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-bone-2">
          <span className="block h-px w-8 bg-clearance" />
          {kicker}
        </Reveal>
        <Reveal as="h1" stagger={1} className="display-xl max-w-[14ch]">
          {title}
        </Reveal>
        {lead ? (
          <Reveal stagger={2} as="p" className="mt-8 max-w-[56ch] text-[18px] leading-[1.55] text-bone-2">
            {lead}
          </Reveal>
        ) : null}
      </div>
    </header>
  );
}
