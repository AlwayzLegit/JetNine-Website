import { Reveal } from "@/components/reveal";
import { RATES, RATES_UPDATED } from "@/lib/rates";

/**
 * The published hourly rate card as a table — shared by /cost-calculator
 * and the pricing-guide chapters so the figures render identically
 * everywhere they appear (single source: src/lib/rates.ts).
 */
export function RateTable({ footnote = true }: { footnote?: boolean }) {
  return (
    <>
      <Reveal className="overflow-x-auto rounded-[4px] border border-ink-3 bg-ink-2">
        <table className="w-full min-w-[680px] border-collapse text-left">
          <thead>
            <tr className="border-b border-ink-3">
              {["Category", "Typical mission", "Sample lane", "Market hourly", "Card locked"].map((h) => (
                <th
                  key={h}
                  className="px-6 py-4 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-bone-2"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RATES.map((r) => (
              <tr key={r.category} className="border-b border-ink-3 last:border-b-0">
                <td className="px-6 py-5 font-serif text-[18px] font-normal tracking-tight text-bone">
                  {r.category}
                </td>
                <td className="px-6 py-5 text-[13px] text-bone-2">{r.mission}</td>
                <td className="px-6 py-5 font-mono text-[12px] tracking-[0.04em] text-bone-2">
                  {r.sample}
                </td>
                <td className="px-6 py-5 font-mono text-[13px] tracking-[0.02em] text-bone">
                  {r.market}
                </td>
                <td className="px-6 py-5 font-mono text-[13px] tracking-[0.02em] text-clearance">
                  {r.locked}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Reveal>
      {footnote ? (
        <p className="mt-5 max-w-[70ch] font-mono text-[11px] uppercase tracking-[0.1em] leading-[1.8] text-steel">
          — Included: flight time, fuel, crew, landing, repositioning, 7.5% FET, standard
          catering, sedan transfer · Itemized separately: premium catering, de-icing,
          international handling · Rates reviewed quarterly · Updated {RATES_UPDATED}
        </p>
      ) : null}
    </>
  );
}
