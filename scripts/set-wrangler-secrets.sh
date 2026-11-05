#!/usr/bin/env bash
# Copy the site's server-side secrets into the Cloudflare Worker.
# Replaces scripts/set-vercel-env.sh for the Cloudflare deployment.
#
# Usage:
#   1. Put the values in a dotenv file that is NOT committed, e.g. .env.cloudflare
#      (copy them from the Vercel dashboard → Settings → Environment Variables,
#      or `vercel env pull .env.cloudflare --environment=production`).
#   2. bash scripts/set-wrangler-secrets.sh .env.cloudflare            # production
#      bash scripts/set-wrangler-secrets.sh .env.cloudflare staging    # staging
#
# Only the names in SECRETS below are uploaded; anything else in the file is
# ignored. Empty values are skipped so optional integrations stay dark.
# Plain config (DEPLOY_ENV, NEXT_PUBLIC_SITE_URL) lives in wrangler.jsonc vars,
# and NEXT_PUBLIC_* build-time values in the GitHub deploy workflow.

set -euo pipefail

ENV_FILE="${1:?usage: set-wrangler-secrets.sh <dotenv-file> [staging]}"
TARGET="${2:-production}"

SECRETS=(
  DATABASE_URL DIRECT_URL
  NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY
  CRON_SECRET AI_KEYS_ENCRYPTION_KEY BLOG_ADMIN_API_KEY HF_TOKEN BLOG_IMAGE_MODEL
  RESEND_API_KEY POSTMARK_SERVER_TOKEN EMAIL_FROM DISPATCH_NOTIFY_EMAIL INBOUND_EMAIL_SECRET
  TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_SMS_FROM TWILIO_WHATSAPP_FROM
  STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET
  SENTRY_DSN SENTRY_TRACES_SAMPLE_RATE
  NEXT_PUBLIC_POSTHOG_KEY NEXT_PUBLIC_POSTHOG_HOST
)

json="{"
sep=""
for name in "${SECRETS[@]}"; do
  # Last assignment wins; strip optional surrounding quotes.
  value="$(grep -E "^${name}=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/' || true)"
  [ -z "$value" ] && continue
  json+="${sep}$(node -e 'process.stdout.write(JSON.stringify(process.argv[1])+":"+JSON.stringify(process.argv[2]))' "$name" "$value")"
  sep=","
  echo "  will set $name"
done
json+="}"

env_flag=()
[ "$TARGET" = "staging" ] && env_flag=(--env staging)

printf '%s' "$json" | pnpm exec wrangler secret bulk "${env_flag[@]}"
echo "Done ($TARGET). Secrets apply to the next request; no redeploy needed."
