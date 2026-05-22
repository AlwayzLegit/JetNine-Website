/**
 * Next.js 15 instrumentation hook — runs once per runtime (Node + Edge).
 * Use for SDK init (Sentry, OpenTelemetry, etc.). Logs alone go to stdout
 * which Vercel surfaces via Function Logs.
 *
 * Sentry is intentionally NOT installed yet to keep the bundle lean. When
 * you want it on:
 *   1. pnpm add @sentry/nextjs
 *   2. Add SENTRY_DSN + (optional) SENTRY_AUTH_TOKEN to .env.local + Vercel
 *   3. Uncomment the Sentry blocks below
 *   4. `npx @sentry/wizard@latest -i nextjs` to bootstrap config if you'd
 *      rather use the wizard
 */
export async function register() {
  // eslint-disable-next-line no-console
  console.log(
    `[instrumentation] runtime=${process.env.NEXT_RUNTIME} build=${process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local"}`,
  );

  // — Sentry (commented out until @sentry/nextjs is installed) —
  // const dsn = process.env.SENTRY_DSN;
  // if (!dsn) return;
  // if (process.env.NEXT_RUNTIME === "nodejs") {
  //   const Sentry = await import("@sentry/nextjs");
  //   Sentry.init({
  //     dsn,
  //     tracesSampleRate: 0.1,
  //     environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  //     release: process.env.VERCEL_GIT_COMMIT_SHA,
  //   });
  // }
  // if (process.env.NEXT_RUNTIME === "edge") {
  //   const Sentry = await import("@sentry/nextjs");
  //   Sentry.init({
  //     dsn,
  //     tracesSampleRate: 0.1,
  //     environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  //     release: process.env.VERCEL_GIT_COMMIT_SHA,
  //   });
  // }
}

/**
 * Next.js 15 request-error hook. Catches errors thrown from React Server
 * Components, Server Actions, Route Handlers, and middleware. Centralized
 * here so the error-capture story is one swap away from Sentry.
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

  // — Sentry (uncomment with the dep installed) —
  // const Sentry = await import("@sentry/nextjs").catch(() => null);
  // Sentry?.captureRequestError(err, request, context);
}
