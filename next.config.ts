import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Supabase host (for connect-src + img-src CSP entries). Falls back to the
// project we ship against so previews + dev keep working.
const supabaseHost = (() => {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return "*.supabase.co";
  try {
    return new URL(raw).host;
  } catch {
    return "*.supabase.co";
  }
})();

// Content-Security-Policy — pragmatic defaults that hold up under Next.js'
// SSR + React hydration. Notes:
//   - 'unsafe-inline' for script-src is unavoidable without a nonce-injection
//     middleware (Next bakes inline bootstrap scripts into the HTML). Switch
//     to nonces later if a stricter policy is needed.
//   - 'unsafe-inline' for style-src covers Tailwind's component primitives
//     in globals.css and inline `style={...}` props the design system uses.
//   - connect-src whitelists the Supabase REST + Realtime sockets.
//   - PostHog hosts are allowed unconditionally; the SDK only initializes
//     when NEXT_PUBLIC_POSTHOG_KEY is set (instrumentation-client.ts), so
//     the policy entries are a no-op when analytics is dark. us-assets
//     serves the SDK's lazy-loaded chunks; us.i is event ingest.
//   - Development only: webpack's dev runtime evaluates modules with eval,
//     and a local Supabase stack is served over plain http / ws. Neither
//     entry is present in production builds.
const devScript = isProd ? "" : " 'unsafe-eval'";
const devConnect = isProd ? "" : ` http://${supabaseHost} ws://${supabaseHost}`;
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${devScript} https://us-assets.i.posthog.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  `img-src 'self' data: blob: https://jetnine.com https://${supabaseHost}`,
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost}${devConnect} https://us.i.posthog.com https://us-assets.i.posthog.com`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Stamped once per build: the sitemap's lastmod for pages whose content
  // ships with the code (so it moves on deploy, not on every hourly
  // sitemap regeneration).
  env: { SITE_BUILT_AT: new Date().toISOString() },
  // Keep postgres.js out of the webpack server bundle. Bundling broke its
  // instanceof-based param type inference (Date params reached
  // Buffer.byteLength raw), which silently disabled the rate limiter in
  // production. Externalizing is the documented setup for native-protocol
  // DB drivers and removes the whole class of realm-mismatch bugs.
  serverExternalPackages: ["postgres"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "jetnine.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  // 301s for URLs people (and AI crawlers) guess by convention — PostHog
  // shows real visits 404ing on these exact paths. Each redirect turns a
  // dead landing into the canonical page and consolidates any link equity
  // pointed at the guessed URL.
  async redirects() {
    return [
      { source: "/about-us", destination: "/about", permanent: true },
      { source: "/team", destination: "/about", permanent: true },
      { source: "/privacy", destination: "/legal", permanent: true },
      { source: "/privacy-policy", destination: "/legal", permanent: true },
      { source: "/terms", destination: "/legal", permanent: true },
      { source: "/terms-of-service", destination: "/legal", permanent: true },
      { source: "/login", destination: "/sign-in", permanent: true },
      { source: "/dashboard", destination: "/account", permanent: true },
      { source: "/fleet", destination: "/aircraft", permanent: true },
      { source: "/pricing", destination: "/cost-calculator", permanent: true },
      // Dispatch desk collapse (redesign phase 5): fifteen sections became
      // five. Old links live in dispatch emails and bookmarks, so they keep
      // resolving. Not permanent — the desk is behind sign-in and these may
      // move again.
      { source: "/admin/dispatch", destination: "/admin/requests", permanent: false },
      { source: "/admin/quote", destination: "/admin/requests", permanent: false },
      { source: "/admin/quote/:id", destination: "/admin/requests/:id", permanent: false },
      { source: "/admin/trip", destination: "/admin/trips", permanent: false },
      { source: "/admin/trip/:id", destination: "/admin/trips/:id", permanent: false },
      { source: "/admin/member", destination: "/admin/clients", permanent: false },
      { source: "/admin/member/:id", destination: "/admin/clients/:id", permanent: false },
      { source: "/admin/inquiries", destination: "/admin/messages?tab=form", permanent: false },
      { source: "/admin/voice", destination: "/admin/messages?tab=calls", permanent: false },
      { source: "/admin/reports", destination: "/admin/settings/reports", permanent: false },
      { source: "/admin/audit", destination: "/admin/settings/history", permanent: false },
      { source: "/admin/health", destination: "/admin/settings/connections", permanent: false },
    ];
  },
};

export default nextConfig;
