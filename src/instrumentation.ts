/**
 * Next.js 15 instrumentation hook — runs once per runtime (Node + Edge).
 *
 * Sentry init is conditional on SENTRY_DSN being set. Without a DSN, the
 * SDK is imported but no events are sent — bundle weight only. This keeps
 * dev / preview clean while letting prod opt in by adding the env var.
 */
export async function register() {
  // eslint-disable-next-line no-console
  console.log(
    `[instrumentation] runtime=${process.env.NEXT_RUNTIME} build=${process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local"}`,
  );

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
  });
}

/**
 * Next.js 15 request-error hook. Catches errors thrown from React Server
 * Components, Server Actions, Route Handlers, and middleware. Forwards
 * to Sentry when configured; always emits a tagged JSON line so log
 * aggregators have something to alert on even when Sentry is off.
 */
export async function onRequestError(
  err: unknown,
  request: {
    path: string;
    method: string;
    headers: Record<string, string | undefined>;
  },
  context: { routerKind: "Pages Router" | "App Router"; routePath: string; routeType: "render" | "route" | "action" | "middleware" },
) {
  const msg = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  const payload = {
    routeType: context.routeType,
    routePath: context.routePath,
    method: request.method,
    path: request.path,
    msg,
    digest: (err as { digest?: string })?.digest ?? null,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
  };
  // eslint-disable-next-line no-console
  console.error(`[request-error] ${JSON.stringify(payload)}\n${stack ?? ""}`);

  if (process.env.SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs").catch(() => null);
    Sentry?.captureRequestError(err, request, context);
  }
}
