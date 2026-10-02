import { TRUST_BAR, type TrustBarItem } from "@/lib/constants";

function formatTrust(item: TrustBarItem): string {
  return "value" in item
    ? `${item.value.toLocaleString("en-US")}${item.suffix ?? ""}`
    : item.static;
}

/**
 * Seven proof points on the ink-2 band under the hero: Fraunces 30px
 * value over a 14px steel label. Seven columns from the desktop
 * breakpoint; a horizontal strip (scrollbar hidden) below it.
 */
export function TrustBar() {
  return (
    <section aria-label="Trust indicators" className="border-y border-line-faint bg-ink-2">
      <div tabIndex={0} role="region" aria-label="Why JetNine" className="container-jn relative flex gap-4 overflow-x-auto py-7 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-7 lg:overflow-visible">
        {TRUST_BAR.map((item) => (
          <div key={item.label} className="min-w-[150px] flex-none lg:min-w-0">
            <div className="font-serif text-[30px] font-light leading-none text-bone">
              {formatTrust(item)}
            </div>
            <div className="mt-[6px] text-[14px] leading-[1.4] text-steel">{item.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
