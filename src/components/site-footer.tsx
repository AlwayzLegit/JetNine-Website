import Link from "next/link";
import { BrandMark } from "./brand-mark";

type FooterLink = { label: string; href: string };

// Light handoff footer (jn-light-chrome.js): wordmark + city, a site nav
// and a short legal nav on one row, then the broker line. Programs, city
// hubs, questions and the account stay linked from here now that they
// are out of the header.
const SITE_LINKS: FooterLink[] = [
  { label: "Aircraft", href: "/aircraft" },
  { label: "Routes", href: "/routes" },
  { label: "Charter by city", href: "/private-jet-charter" },
  { label: "Cost calculator", href: "/cost-calculator" },
  { label: "Programs", href: "/memberships" },
  { label: "Guides", href: "/guides" },
  { label: "How it works", href: "/how-it-works" },
  { label: "About", href: "/about" },
  { label: "Journal", href: "/blog" },
  { label: "Good questions", href: "/questions" },
  { label: "Contact", href: "/contact" },
  { label: "My account", href: "/account" },
];

const LEGAL_LINKS: FooterLink[] = [
  { label: "Safety", href: "/safety" },
  { label: "Empty legs", href: "/empty-legs" },
  { label: "FAQ", href: "/faq" },
  // Spelled out for third-party compliance reviewers (A2P 10DLC, ad
  // platforms) whose vetting scans footers for these literal labels.
  { label: "Privacy policy", href: "/legal" },
  { label: "Terms of service", href: "/legal#agreement" },
];

const linkClass = "text-bone transition-colors hover:text-gold max-md:inline-flex max-md:min-h-[28px] max-md:items-center";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line bg-ink font-serif max-md:bg-white max-md:font-sans">
      <div className="container-jn pb-[18px] pt-[22px] max-md:pb-[26px]">
        <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-4 max-md:block">
          <div className="flex-none">
            <BrandMark size="sm" className="!text-[19px] max-md:!text-[18px]" />
            <div className="mt-[2px] text-[12px] text-steel max-md:hidden">Los Angeles, California</div>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] max-md:mt-[14px] max-md:gap-x-[18px] max-md:text-[14px]">
            {SITE_LINKS.map((l) => (
              <Link key={l.label} href={l.href} className={linkClass}>
                {l.label}
              </Link>
            ))}
          </nav>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] max-md:mt-2 max-md:gap-x-[18px] max-md:text-[14px]">
            {LEGAL_LINKS.map((l) => (
              <Link key={l.label} href={l.href} className={linkClass}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-4 flex flex-wrap justify-between gap-4 border-t border-line pt-3 text-[12px] leading-[1.5] text-steel max-md:mt-[14px] max-md:block max-md:border-0 max-md:pt-0">
          <span className="max-md:block">
            JetNine is a Part 295 indirect air carrier. Flights are operated by FAA Part 135 certificated air carriers.
          </span>
          <span className="max-md:block">© {year} JetNine. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
