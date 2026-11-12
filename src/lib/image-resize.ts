import { getCloudflareContext } from "@opennextjs/cloudflare";

// Resizes and re-encodes an uploaded image through the Cloudflare Images
// binding (IMAGES in wrangler.jsonc). This replaces sharp, which is a native
// module and cannot load on Workers. `wrangler dev` and `next dev` (via
// initOpenNextCloudflareForDev) both provide the binding locally.

type ImagesBinding = {
  input(stream: ReadableStream<Uint8Array>): {
    transform(t: { width: number; height: number; fit: "cover" }): {
      output(o: { format: "image/webp"; quality: number }): Promise<{ response(): Response }>;
    };
  };
};

export class ImageResizeUnavailable extends Error {}

export async function toWebpCover(
  raw: Uint8Array,
  width: number,
  height: number,
  quality = 82,
): Promise<Buffer> {
  let images: ImagesBinding | undefined;
  try {
    images = (getCloudflareContext().env as { IMAGES?: ImagesBinding }).IMAGES;
  } catch {
    images = undefined;
  }
  if (!images) throw new ImageResizeUnavailable("IMAGES binding is not configured");

  const input = new Blob([new Uint8Array(raw)]).stream();
  const result = await images
    .input(input)
    .transform({ width, height, fit: "cover" })
    .output({ format: "image/webp", quality });
  return Buffer.from(await result.response().arrayBuffer());
}
