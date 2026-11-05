import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";

// ISR + data cache on Cloudflare:
//   - R2 holds rendered pages and unstable_cache entries (`revalidate = N`).
//   - The Durable Object queue runs background revalidation after a stale hit.
//   - D1 records revalidateTag / revalidatePath so every isolate sees them.
// Bindings are declared in wrangler.jsonc.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  queue: doQueue,
  tagCache: d1NextTagCache,
  enableCacheInterception: true,
});
