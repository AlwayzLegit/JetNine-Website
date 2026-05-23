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
//   - plausible.io is allowed unconditionally; the script only loads when
//     NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set on the page side, so the policy
//     entry is a no-op when analytics is dark.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://plausible.io",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  `img-src 'self' data: blob: https://images.unsplash.com https://jetnine.com https://${supabaseHost}`,
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://plausible.io`,
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
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
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
};

export default nextConfig;
