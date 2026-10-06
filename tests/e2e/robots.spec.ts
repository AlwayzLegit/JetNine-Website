import { test, expect } from "@playwright/test";

// Matching for the literal paths and terminal $ used by this site's policy.
// Reject unsupported syntax rather than pretend to implement the entire REP.
function matches(path: string, pattern: string) {
  expect(pattern).not.toContain("*");
  return pattern.endsWith("$") ? path === pattern.slice(0, -1) : path.startsWith(pattern);
}

test("robots serves a precise shared production crawl policy", async ({ request }) => {
  const response = await request.get("/robots.txt", { maxRedirects: 0 });
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/plain");
  const text = await response.text();
  expect(Buffer.byteLength(text)).toBeLessThan(500 * 1024);
  expect(text).not.toContain("\uFFFD");
  expect(text).not.toMatch(/^Host:|^Crawl-delay:|^Noindex:/im);
  expect(text.match(/^Sitemap: .+$/gm)).toEqual(["Sitemap: https://jetnine.com/sitemap.xml"]);
  const agents = [...text.matchAll(/^User-Agent: (.+)$/gm)].map((match) => match[1].trim());
  expect(agents).toEqual(["*", "GPTBot", "ClaudeBot", "Claude-Web", "PerplexityBot", "Google-Extended"]);
  // All user agents must precede the shared rules so specific bots inherit them.
  expect(text.lastIndexOf("User-Agent:")).toBeLessThan(text.indexOf("Allow:"));
  expect(text.match(/^Allow: .+$/gm)).toEqual(["Allow: /"]);
  const disallows = [...text.matchAll(/^Disallow: (.+)$/gm)].map((match) => match[1].trim());
  expect(new Set(disallows).size).toBe(disallows.length);
  const blocked = (path: string) => disallows.some((rule) => matches(path, rule));
  for (const root of ["/account", "/admin", "/api", "/auth", "/sign-in", "/request", "/downloads", "/quote/aircraft", "/quote/contact", "/quote/review"]) {
    for (const suffix of ["", "?next=/", "/", "/example", "/example?x=1"]) {
      expect(blocked(root + suffix), root + suffix).toBe(true);
    }
    expect(blocked(root + "-public-guide"), root + "-public-guide").toBe(false);
  }
  for (const path of ["/", "/sitemap.xml", "/blog", "/quote/mission", "/private-jet-charter", "/aircraft", "/routes", "/_next/static/chunks/app.js", "/_next/image?url=hero.webp", "/images/concierge/hero.webp", "/accounting", "/authentication-guide"]) {
    expect(blocked(path), path).toBe(false);
  }
});
