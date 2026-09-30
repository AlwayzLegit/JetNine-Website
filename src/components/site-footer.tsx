import Link from "next/link";
import { BrandMark } from "./brand-mark";

type FooterCol = { heading: string; links: { label: string; href: string }[] };

// Same link list as the live site — every link resolves. Column headings
// and the legal line follow the simplification handoff (Instrument Sans,
// sentence case, no mono labels).
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
      { label: "Cost calculator", href: "/cost-calculator" },
      { label: "Pricing guide", href: "/guides" },
      { label: "Routes", href: "/routes" },
      { label: "Charter by city", href: "/private-jet-charter" },
      { label: "Empty legs", href: "/empty-legs" },
      { label: "Safety", href: "/safety" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "Contact", href: "/contact" },
      { label: "FAQ", href: "/faq" },
      { label: "Good questions", href: "/questions" },
      { label: "Legal", href: "/legal" },
      // Spelled out for third-party compliance reviewers (A2P 10DLC, ad
      // platforms) whose vetting scans footers for these literal labels.
      { label: "Privacy policy", href: "/legal" },
      { label: "Terms of service", href: "/legal#agreement" },
      { label: "My account", href: "/account" },
    ],
  },
];

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line-faint bg-ink pt-16 pb-10">
      <div className="container-jn">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div>
            <BrandMark />
            <p className="mt-4 max-w-[30ch] text-[15px] leading-[1.55] text-bone-2">
              On-demand private aviation. One number, one desk, ready when you are.
            </p>
            <p className="mt-5 text-[14px] leading-[1.55] text-steel">
              Operating hours
              <br />
              <span className="text-bone-2">24 / 7 · always answered</span>
            </p>
          </div>

          {FOOTER_COLS.map((col) => (
            <div key={col.heading}>
              <h4 className="mb-[14px] text-[14px] font-semibold text-steel">{col.heading}</h4>
              <ul className="flex flex-col gap-[10px]">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[15px] text-bone transition-colors hover:text-bone-2"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line-faint pt-6 text-[13px] leading-[1.5] text-steel">
          <span>© {year} JetNine · Part 295 indirect air carrier</span>
          <span>Flights operated by FAA Part 135 certificated air carriers</span>
        </div>
      </div>
    </footer>
  );
}
