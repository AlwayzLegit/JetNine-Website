import { test, expect } from "@playwright/test";

test("sitemap XML lists only healthy, canonical, indexable public pages", async ({ page, request }) => {
  test.setTimeout(180_000);
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/xml");
  const xml = await response.text();
  expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  expect(Buffer.byteLength(xml, "utf8")).toBeLessThanOrEqual(50 * 1024 * 1024);
  const parsed = await page.evaluate((source) => {
    const document = new DOMParser().parseFromString(source, "application/xml");
    return {
      error: document.querySelector("parsererror")?.textContent,
      namespace: document.documentElement.namespaceURI,
      root: document.documentElement.localName,
      ignoredFields: document.querySelectorAll("priority, changefreq").length,
      entries: [...document.getElementsByTagNameNS("http://www.sitemaps.org/schemas/sitemap/0.9", "url")].map((entry) => ({
        url: entry.getElementsByTagNameNS("http://www.sitemaps.org/schemas/sitemap/0.9", "loc")[0]?.textContent ?? "",
        lastmod: entry.getElementsByTagNameNS("http://www.sitemaps.org/schemas/sitemap/0.9", "lastmod")[0]?.textContent,
      })),
    };
  }, xml);
  expect(parsed.error).toBeUndefined();
  expect(parsed.root).toBe("urlset");
  expect(parsed.namespace).toBe("http://www.sitemaps.org/schemas/sitemap/0.9");
  expect(parsed.ignoredFields).toBe(0);
  expect(parsed.entries.length).toBeGreaterThan(100);
  expect(parsed.entries.length).toBeLessThanOrEqual(50_000);
  expect(new Set(parsed.entries.map((entry) => entry.url)).size).toBe(parsed.entries.length);
  const origin = new URL(parsed.entries[0].url).origin;
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  const robotsText = await robots.text();
  expect(robotsText).toContain(`Sitemap: ${origin}/sitemap.xml`);
  const disallows = [...robotsText.matchAll(/^Disallow: (.+)$/gm)].map((match) => match[1].trim());
  const problems: string[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < parsed.entries.length) {
      const entry = parsed.entries[next++];
      const url = new URL(entry.url);
      expect(url.origin).toBe(origin);
      expect(url.search + url.hash).toBe("");
      expect(disallows.some((rule) => (rule.endsWith("$") ? url.pathname === rule.slice(0, -1) : url.pathname.startsWith(rule)))).toBe(false);
      expect(url.pathname).not.toMatch(/^\/(account|admin|api|auth|sign-in|request|downloads)(\/|$)/);
      expect(url.pathname).not.toMatch(/^\/quote\/(aircraft|contact|review)$/);
      if (!url.pathname.startsWith("/blog/")) expect(entry.lastmod).toBeUndefined();
      else if (entry.lastmod) expect(Number.isFinite(Date.parse(entry.lastmod))).toBe(true);
      const target = await request.get(url.pathname, { maxRedirects: 0 });
      if (target.status() !== 200) {
        problems.push(`${url.pathname}: HTTP ${target.status()}`);
        continue;
      }
      const html = await target.text();
      const metadata = await page.evaluate((source) => {
        const document = new DOMParser().parseFromString(source, "text/html");
        return {
          canonical: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.getAttribute("href"),
          robots: [...document.querySelectorAll<HTMLMetaElement>('meta[name="robots"], meta[name="googlebot"]')].map((meta) => meta.content).join(","),
        };
      }, html);
      if (!metadata.canonical || new URL(metadata.canonical, origin).href !== entry.url) problems.push(`${url.pathname}: canonical mismatch`);
      if (/\bnoindex\b/i.test(`${metadata.robots},${target.headers()["x-robots-tag"] ?? ""}`)) problems.push(`${url.pathname}: noindex`);
    }
  }));
  expect(problems, problems.join("\n")).toEqual([]);
});
