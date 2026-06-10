/**
 * Client-side product-event capture. Same ships-dark contract as the
 * PostHog init in instrumentation-client.ts: without
 * NEXT_PUBLIC_POSTHOG_KEY this is a no-op and the SDK chunk never
 * downloads, so callsites can be written (and tested) before the key
 * exists in env.
 *
 * The dynamic import resolves to the same posthog-js singleton the
 * instrumentation file initialized — capture() before init() is queued
 * by the SDK, so there's no race on cold navigation.
 */
export function track(event: string, properties?: Record<string, unknown>): void {
  if (typeof window === "undefined" || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  void import("posthog-js")
    .then(({ default: posthog }) => posthog.capture(event, properties))
    .catch(() => {
      // Analytics must never surface to the user.
    });
}
