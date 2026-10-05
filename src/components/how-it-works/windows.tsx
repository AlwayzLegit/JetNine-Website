import Link from "next/link";
import { PRICE_STACK, PRICE_STACK_TOTAL } from "@/lib/rates";
import { Icon, type IconName } from "@/components/company/icons";
import { plainDesc, plainLabel } from "./price-copy";

// Window bodies for /how-it-works — the prototype's JN.open("checklist")
// and JN.open("confirmation") (jn-light-chrome.js), plus the itemized
// example quote that used to sit on the page (src/lib/rates.ts).

const CHECKLIST: [string, string[]][] = [
  ["The proposal", ["Aircraft, airports and itinerary", "Named operating carrier", "Complete price and exclusions"]],
  ["The agreement", ["Payment requirements", "Cancellation and refund terms", "Changes and substitutions"]],
  ["The next step", ["Outstanding confirmation requirements", "Trip contact details"]],
];

export function ChecklistWindow() {
  return (
    <div>
      {CHECKLIST.map(([group, items]) => (
        <div key={group} className="mt-[22px]">
          <p className="eyebrow !mb-[10px] !text-[12px] !font-semibold !tracking-[0.16em]">{group}</p>
          {items.map((t) => (
            <label key={t} className="flex min-h-9 cursor-pointer items-center gap-3 py-1 text-[15px]">
              <input type="checkbox" className="m-0 h-[17px] w-[17px] accent-[var(--bone)]" />
              {t}
            </label>
          ))}
        </div>
      ))}
      <p className="mt-[22px] text-[13px] text-steel">— A checklist does not confirm a booking.</p>
      <Link href="/quote/mission" className="btn btn-primary mt-[14px]">
        Start a trip request →
      </Link>
    </div>
  );
}

const CONFIRM: [IconName, string, string][] = [
  ["calendar", "Route & dates", "Match your agreed itinerary"],
  ["calendar", "Departure times", "Check local times"],
  ["plane", "Aircraft & operator", "Review the confirmed details"],
  ["doc", "Agreement & payment", "Check the required steps"],
  ["person", "Passenger information", "Complete outstanding requests"],
  ["info", "Departure instructions", "Confirm when these will follow"],
  ["phone", "Trip contact", "Know who to reach"],
];

export function ConfirmationWindow() {
  return (
    <div>
      <div className="mt-[18px]">
        {CONFIRM.map(([ic, a, b]) => (
          <div key={a} className="grid grid-cols-[28px_minmax(0,1fr)] items-center gap-x-[14px] border-b border-line py-[11px] text-[15px] sm:grid-cols-[28px_180px_minmax(0,1fr)]">
            <Icon name={ic} className="h-[22px] w-[22px]" />
            <b className="font-semibold">{a}</b>
            <span className="text-steel max-sm:col-start-2">{b}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-[10px] rounded-[3px] bg-surface-2 px-[14px] py-3 text-[14px]">
        <Icon name="info" className="h-5 w-5" />
        <span>
          <b>Ask:</b> What remains outstanding before my flight is confirmed?
        </span>
      </div>
      <p className="mb-[18px] mt-[14px] text-[13px] text-steel">
        A request, quote or payment alone should not be treated as confirmation.
      </p>
    </div>
  );
}

export function ExampleQuoteWindow() {
  return (
    <div>
      <table className="mt-5 w-full border-collapse text-[14px]">
        <thead>
          <tr className="bg-surface-2">
            <th className="border-b border-line px-3 py-[10px] text-left font-semibold">Line</th>
            <th className="border-b border-line px-3 py-[10px] text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {PRICE_STACK.map((p) => (
            <tr key={p.n}>
              <td className="border-b border-line px-3 py-[11px]">
                {plainLabel(p)}
                <span className="block text-[13px] text-steel">{plainDesc(p)}</span>
              </td>
              <td className="border-b border-line px-3 py-[11px] text-right align-top">{p.val}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-navy font-semibold text-white">
            <td className="px-3 py-3">All-in</td>
            <td className="px-3 py-3 text-right">{PRICE_STACK_TOTAL}</td>
          </tr>
        </tfoot>
      </table>
      <p className="mt-4 text-[13px] text-steel">
        Example only — Los Angeles ⇄ New York, midsize, about 10 hours in the air. Your quote is
        priced for your itinerary.
      </p>
      <Link href="/quote/mission" className="btn btn-primary mt-4">
        Request a quote ↗
      </Link>
    </div>
  );
}
