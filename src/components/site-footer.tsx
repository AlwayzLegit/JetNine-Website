import Link from "next/link";
import { BrandMark } from "./brand-mark";

type FooterCol = { heading: string; links: { label: string; href: string }[] };

const FOOTER_COLS: FooterCol[] = [
  {
    heading: "Aircraft",
    links: [
      { label: "Turboprop", href: "/aircraft/turboprop" },
      { label: "Light jets", href: "/aircraft/light" },
      { label: "Midsize", href: "/aircraft/midsize" },
      { label: "Super-midsize", href: "/aircraft/supermid" },
      { label: "Heavy", href: "/aircraft/heavy" },
      { label: "Ultra long range", href: "/aircraft/ultra" },
      { label: "All aircraft", href: "/aircraft" },
    ],
  },
  {
    heading: "Programs",
    links: [
      { label: "JetNine Card", href: "/memberships" },
      { label: "On-demand", href: "/how-it-works" },
      { label: "Empty legs", href: "/empty-legs" },
      { label: "Safety", href: "/safety" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "FAQ", href: "/faq" },
      { label: "Legal", href: "/legal" },
      { label: "My account", href: "/account" },
    ],
  },
];

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-ink-3 bg-ink pt-24 pb-16">
      <div className="container-jn">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1.5fr]">
          <div>
            <BrandMark size="lg" />
            <p className="mt-6 max-w-[34ch] text-[14px] leading-[1.6] text-bone-2">
              On-demand private aviation. One number, one desk, ready when you are.
            </p>
            <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.12em] text-steel">
              — Operating hours
              <br />
              <span className="text-bone-2">24 / 7 · always answered</span>
            </p>
          </div>

          {FOOTER_COLS.map((col) => (
            <div key={col.heading}>
              <h4 className="mb-6 font-mono text-[10px] uppercase tracking-[0.16em] text-bone-2">
                {col.heading}
              </h4>
              <ul className="flex flex-col gap-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[14px] text-bone transition-colors hover:text-clearance"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-ink-3 pt-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-steel">
            © {year} JetNine · Part 295 indirect air carrier
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-steel">
            Flights operated by FAA Part 135 certificated air carriers
          </p>
        </div>
      </div>
    </footer>
  );
}
