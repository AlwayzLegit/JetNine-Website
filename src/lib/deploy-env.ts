// Which deployment this is, independent of the hosting platform.
//
// On Cloudflare, wrangler.jsonc sets DEPLOY_ENV per environment
// ("production" / "staging") and the deploy workflow passes GIT_COMMIT_SHA.
// The VERCEL_* fallbacks keep a Vercel deployment behaving as before, which
// is what a rollback during the migration window runs on.
//
// Functions rather than constants: on Workers, process.env is filled in per
// request, after module evaluation.

/** The declared environment, or a guess from NODE_ENV when none is set. */
export function deployEnv(): string {
  return (
    process.env.DEPLOY_ENV ??
    process.env.VERCEL_ENV ??
    (process.env.NODE_ENV === "production" ? "production" : "development")
  );
}

/**
 * True only when the deployment explicitly declares itself production.
 * `next build` always runs with NODE_ENV=production, so an offline CI build
 * must not count: the sitemap would refuse its seeded fallback and IndexNow
 * would ping from previews.
 */
export function isProductionDeploy(): boolean {
  return (process.env.DEPLOY_ENV ?? process.env.VERCEL_ENV) === "production";
}

export function commitSha(): string {
  return (
    process.env.GIT_COMMIT_SHA ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
    ""
  );
}

export function deployRegion(): string {
  return process.env.DEPLOY_REGION ?? process.env.VERCEL_REGION ?? "local";
}

/** The platform-assigned URL when NEXT_PUBLIC_SITE_URL is not set. */
export function platformBaseUrl(): string | null {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  return host ? `https://${host}` : null;
}
