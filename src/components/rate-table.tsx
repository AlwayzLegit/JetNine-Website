import { RATES, RATES_UPDATED } from "@/lib/rates";
import { findAirport } from "@/lib/airports";

/**
 * The published hourly rate card as a table — shared by /cost-calculator
 * and the pricing-guide chapters so the figures render identically
 * everywhere they appear (single source: src/lib/rates.ts).
 *
 * The data module still carries the old label conventions (pax, NM, /HR,
 * bare airport codes); the plain-words dictionary is applied here at
 * render time so the numbers stay single-sourced.
 */
function plainMission(s: string) {
  return s.replace(/\bpax\b/gi, "passengers").replace(/(\d)\s?NM\b/g, "$1 nm");
}

function plainRate(s: string) {
  return s.replace(/\/HR\b/g, "/hr");
}

// "KVNY → KASE" → "Los Angeles (VNY) → Aspen (ASE)"; unknown codes stay as-is.
function plainLane(s: string) {
  return s
    .split("→")
    .map((code) => {
      const a = findAirport(code.trim());
      return a ? `${a.city} (${a.iata})` : code.trim();
    })
    .join(" → ");
}

export function RateTable({ footnote = true }: { footnote?: boolean }) {
  return (
    <>
      <div className="card relative overflow-x-auto" tabIndex={0} role="region" aria-label="Rates by category — scrolls sideways">
        <table className="table-jn min-w-[720px]">
          <thead>
            <tr>
              {["Category", "Typical mission", "Sample lane", "Market hourly", "Card locked"].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RATES.map((r) => (
              <tr key={r.category}>
                <td className="font-serif text-[20px] font-normal leading-tight tracking-tight text-bone">
                  {r.category}
                </td>
                <td className="text-bone-2">{plainMission(r.mission)}</td>
                <td className="text-bone-2">{plainLane(r.sample)}</td>
                <td className="text-bone">{plainRate(r.market)}</td>
                <td className="font-medium text-clearance">{plainRate(r.locked)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footnote ? (
        <p className="mt-4 max-w-[72ch] text-[14px] leading-[1.6] text-steel">
          Included: flight time, fuel, crew, landing, repositioning, 7.5% FET, standard catering,
          sedan transfer. Itemized separately: premium catering, de-icing, international handling.
          Rates reviewed quarterly · updated {RATES_UPDATED}.
        </p>
      ) : null}
    </>
  );
}
