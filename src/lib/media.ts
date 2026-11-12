import { getCloudflareContext } from "@opennextjs/cloudflare";

// Site media (blog hero images) lives in the R2 bucket bound as MEDIA and is
// served by the edge Worker at /media/<key> (edge/worker.ts). It used to sit
// in Supabase Storage and be hot-linked from every page view, which ran the
// project through its egress quota and took the images down with a 402.
//
// Rows written before the move still hold the Supabase public URL. Reads map
// those to the /media path (`siteMediaUrl`), and the edge Worker copies each
// file out of Supabase once, the first time it is asked for, so nothing in
// the database had to change.

export const MEDIA_PATH_PREFIX = "/media/";

/** Keys the edge Worker will serve; keep in sync with MEDIA_KEY there. */
const MEDIA_KEY = /^blog\/heroes\/[A-Za-z0-9._-]+\.webp$/;

const SUPABASE_PUBLIC_OBJECT = /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/(.+)$/i;

/**
 * The URL a page should use for a stored image: Supabase Storage URLs for
 * files we now host become site paths; anything else passes through.
 */
export function siteMediaUrl<T extends string | null | undefined>(url: T): T | string {
  if (!url) return url;
  const m = SUPABASE_PUBLIC_OBJECT.exec(url);
  if (!m) return url;
  const key = m[1].split("?")[0];
  return MEDIA_KEY.test(key) ? `${MEDIA_PATH_PREFIX}${key}` : url;
}

type MediaBucket = {
  put(
    key: string,
    value: ArrayBuffer | Uint8Array,
    options?: { httpMetadata?: { contentType?: string; cacheControl?: string } },
  ): Promise<unknown>;
};

export class MediaStoreUnavailable extends Error {}

/** Stores a file in the media bucket and returns its site path. */
export async function putMedia(key: string, bytes: Uint8Array, contentType: string): Promise<string> {
  if (!MEDIA_KEY.test(key)) throw new Error(`Unsupported media key: ${key}`);
  let bucket: MediaBucket | undefined;
  try {
    bucket = (getCloudflareContext().env as { MEDIA?: MediaBucket }).MEDIA;
  } catch {
    bucket = undefined;
  }
  if (!bucket) throw new MediaStoreUnavailable("MEDIA binding is not configured");
  await bucket.put(key, bytes, { httpMetadata: { contentType } });
  return `${MEDIA_PATH_PREFIX}${key}`;
}
