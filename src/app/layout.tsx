import type { Metadata, Viewport } from "next";
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
  // Search Console / Webmaster verification — populated from env so we
  // don't bake a tenant-specific token into the repo. Ships dark when
  // unset; once Google/Bing verify ownership the value can stay or be
  // removed at will.
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
};

// Mobile browser chrome (iOS status bar, Android URL bar background)
// pulls from theme-color. Match the brand ink so the chrome blends
// rather than showing the default white strip above the page.
export const viewport: Viewport = {
  themeColor: "#07080A",
  colorScheme: "dark",
};

// JSON-LD structured data. Organization gives Google a hook for the
// knowledge panel; WebSite links the corresponding domain to that
// organization so the two entities don't float independently. No
// `address` on Organization because we're a broker (no public-facing
// terminal); contact is the dispatch line.
//
// @id values are stable URIs that Google uses to wire references
// together. Other pages with their own structured data — /about
// AboutPage.mainEntity, /aircraft Service.provider — should point at
// `${SITE_URL}/#organization` to feed the same graph node.
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: "JetNine",
  legalName: "JetNine LLC",
  url: SITE_URL,
  logo: `${SITE_URL}/opengraph-image`,
  description:
    "JetNine LLC is a Part 295 indirect air carrier registered with the U.S. DOT. Every flight is operated by an independent FAA Part 135 certificated direct air carrier.",
  contactPoint: [
    {
      "@type": "ContactPoint",
      telephone: "+1-818-900-5278",
      contactType: "Dispatch",
      areaServed: "Worldwide",
      availableLanguage: ["English"],
    },
  ],
  areaServed: { "@type": "Place", name: "Worldwide" },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  url: SITE_URL,
  name: "JetNine",
  description: "Private aviation, ready when you are.",
  publisher: { "@id": `${SITE_URL}/#organization` },
  inLanguage: "en-US",
};

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Supabase requests use the project's REST + Realtime hosts. preconnect
// kicks off the DNS + TLS handshake at HTML parse time so the first
// auth check on /account, /admin, /quote etc. doesn't pay that cost.
const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : null;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        {/* Connection hints — start TLS handshakes for third-party
            origins early so the first request to each doesn't pay the
            ~100-300ms handshake cost on top of the actual response. */}
        {supabaseOrigin ? (
          <>
            <link rel="preconnect" href={supabaseOrigin} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={supabaseOrigin} />
          </>
        ) : null}
        {/* PostHog initializes in instrumentation-client.ts (env-gated on
            NEXT_PUBLIC_POSTHOG_KEY); these hints just warm the ingest
            connection so the first capture doesn't pay the handshake. */}
        {posthogKey ? (
          <>
            <link rel="preconnect" href={posthogHost} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={posthogHost} />
          </>
        ) : null}
      </head>
      <body>
        <script
          type="application/ld+json"
          // Stringified at build time, not user-controlled — no XSS risk.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
