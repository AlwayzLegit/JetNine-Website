import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  weight: ["400", "500"],
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com";

export const metadata: Metadata = {
  title: {
    default: "JetNine — Private aviation, ready when you are",
    template: "%s · JetNine",
  },
  description:
    "JetNine is a Part 295 indirect air carrier brokering on-demand private charter on Part 135 operators. One number, one desk, ready when you are.",
  metadataBase: new URL(SITE_URL),
  applicationName: "JetNine",
  keywords: [
    "private jet charter",
    "private aviation",
    "Part 295 broker",
    "Part 135 operator",
    "on-demand charter",
    "jet card",
    "empty leg flights",
    "ARG/US Platinum",
  ],
  authors: [{ name: "JetNine LLC" }],
  creator: "JetNine LLC",
  publisher: "JetNine LLC",
  formatDetection: { telephone: true, email: true, address: false },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "JetNine",
    title: "JetNine — Private aviation, ready when you are",
    description:
      "Part 295 indirect air carrier. Senior-dispatcher charter brokerage on ARG/US Platinum Part 135 operators. Quote returned in under 30 minutes.",
  },
  twitter: {
    card: "summary_large_image",
    title: "JetNine — Private aviation, ready when you are",
    description:
      "Part 295 indirect air carrier. Senior-dispatcher charter brokerage. Quote returned in under 30 minutes.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  alternates: { canonical: "/" },
};

// JSON-LD structured data. Organization schema gives Google a hook for
// the knowledge panel. No `address` because we're a broker (no
// public-facing terminal); contact is the dispatch line.
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "JetNine",
  legalName: "JetNine LLC",
  url: SITE_URL,
  logo: `${SITE_URL}/opengraph-image`,
  description:
    "JetNine LLC is a Part 295 indirect air carrier registered with the U.S. DOT. Every flight is operated by an independent FAA Part 135 certificated direct air carrier.",
  contactPoint: [
    {
      "@type": "ContactPoint",
      telephone: "+1-888-847-5669",
      contactType: "Dispatch",
      areaServed: "Worldwide",
      availableLanguage: ["English"],
    },
  ],
  areaServed: { "@type": "Place", name: "Worldwide" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <script
          type="application/ld+json"
          // Stringified at build time, not user-controlled — no XSS risk.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
