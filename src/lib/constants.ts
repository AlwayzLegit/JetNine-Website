export const SITE = {
  brand: "JetNine",
  brandSuffix: "09",
  dispatchPhone: "+1 (424) 487-2707",
  dispatchPhoneE164: "+14244872707",
  email: "info@jetnine.com",
  address: {
    line1: "2934 Beverly Glen Circle Suite 123",
    cityState: "Los Angeles, CA 90077",
  },
  legal: {
    part295: "JetNine is an indirect air carrier — Part 295 broker. All flights operated by FAA Part 135 certified carriers.",
    foundedYear: 2026,
  },
} as const;

// Default broker markup applied to an operator's all-in cost when a
// dispatcher pastes an Avinode sourced option (client_price = cost × (1 +
// pct/100)). Overridable per option in the workbench. Kept as a constant
// for now; promote to a configurable admin setting later if needed.
export const DEFAULT_MARKUP_PCT = 12;

export const TRUST_BAR = [
  { value: 20000, label: "Aircraft network", suffix: "+" },
  { value: 170, label: "Countries", suffix: "+" },
  { value: 24, label: "Dispatch", suffix: "/7" },
  { value: 4, label: "Avg. response", suffix: " min" },
  { static: "ARGUS", label: "Wyvern vetted" },
  { static: "295", label: "Part 295 broker" },
] as const;

export type TrustBarItem = (typeof TRUST_BAR)[number];

export const PRIMARY_NAV = [
  { href: "/", label: "Home" },
  { href: "/aircraft", label: "Aircraft" },
  { href: "/memberships", label: "Programs" },
  { href: "/how-it-works", label: "Why JetNine" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;
