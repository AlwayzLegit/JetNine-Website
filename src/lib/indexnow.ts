// IndexNow — push change notifications to the engines that support the
// protocol (Bing, Seznam, Yandex, Naver; submissions are shared between
// them). Google does not consume IndexNow — its side is covered by the
// sitemap + Search Console.
//
// The key is intentionally committed: IndexNow proves host ownership by
// serving the key at https://<host>/<key>.txt (public/6038fcc….txt), so
// the value is public by design and is not a secret.
export const INDEXNOW_KEY = "6038fccfe1503074feb48300db2b2c15";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");

/**
 * Notify IndexNow that the given paths changed (created, updated, or
 * deleted — the protocol doesn't distinguish; engines re-crawl and see).
 *
 * Only fires on the production deployment: previews and dev would submit
 * jetnine.com URLs whose content doesn't match what's live. Never throws —
 * a failed ping costs a crawl hint, not the publish.
 */
export async function pingIndexNow(paths: string[]): Promise<void> {
  if (process.env.VERCEL_ENV !== "production") return;

  const urlList = [...new Set(paths)]
    .filter(Boolean)
    .map((p) => (p.startsWith("http") ? p : `${SITE_URL}${p.startsWith("/") ? p : `/${p}`}`));
  if (urlList.length === 0) return;

  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: new URL(SITE_URL).host,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList,
      }),
      // The publish response shouldn't hang on a slow third party.
      signal: AbortSignal.timeout(5_000),
    });
    // 200 = accepted, 202 = accepted / key validation pending.
    if (!res.ok && res.status !== 202) {
      console.error(`indexnow ping rejected: ${res.status} for ${urlList.length} url(s)`);
    }
  } catch (err) {
    console.error("indexnow ping failed (non-fatal)", err);
  }
}
