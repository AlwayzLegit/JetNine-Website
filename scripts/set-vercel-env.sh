#!/usr/bin/env bash
# Vercel env setup for jet-nine-website.
# Run from any directory; uses the official Vercel CLI.
#
# Prerequisites:
#   1. Create a Vercel token at https://vercel.com/account/tokens
#      (revoke the one you pasted in chat — that's compromised now).
#   2. Grab three secrets from Supabase dashboard:
#        - Database password (Project Settings → Database → Reset password
#          if you don't have it stored).
#        - Service role key (Project Settings → API → service_role).
#   3. Set the four placeholders below, then run:
#        bash set-vercel-env.sh
#
# Notes:
#   - Sets vars on all three scopes (production, preview, development) so
#     preview branches off PRs work too.
#   - Idempotent: removes any prior value before adding the new one, so
#     re-running is safe.

set -euo pipefail

# ─── EDIT THESE ──────────────────────────────────────────────────────────
VERCEL_TOKEN_NEW="REPLACE_WITH_FRESH_TOKEN"
SUPABASE_DB_PASSWORD="REPLACE_WITH_SUPABASE_DB_PASSWORD"
SUPABASE_SERVICE_ROLE="REPLACE_WITH_SUPABASE_SERVICE_ROLE_KEY"
SITE_URL="https://jetnine.com"   # or your actual prod domain
# ─────────────────────────────────────────────────────────────────────────

PROJECT="jet-nine-website"
TEAM="alwayzlegits-projects"

# Construct the DB URLs from the password.
DB_HOST_POOLER="aws-0-us-east-2.pooler.supabase.com"
DB_HOST_DIRECT="db.szuztxfhkudcjzhrkfld.supabase.co"
DB_USER_POOLER="postgres.szuztxfhkudcjzhrkfld"
DB_USER_DIRECT="postgres"

DATABASE_URL="postgresql://${DB_USER_POOLER}:${SUPABASE_DB_PASSWORD}@${DB_HOST_POOLER}:6543/postgres?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://${DB_USER_DIRECT}:${SUPABASE_DB_PASSWORD}@${DB_HOST_DIRECT}:5432/postgres?sslmode=require"

# Public values (no secrets — fine to commit).
SUPABASE_URL="https://szuztxfhkudcjzhrkfld.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6dXp0eGZoa3VkY2p6aHJrZmxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNTg2NzgsImV4cCI6MjA5NDgzNDY3OH0.2mtWMQIq31qxYJMylawcgDCYFY92gsXzNGw_XGLd2fA"

set_env() {
  local name="$1"; local value="$2"
  for env in production preview development; do
    # `vercel env rm` is interactive by default; --yes skips the prompt.
    # We swallow stderr/stdout because rm fails when the var doesn't exist
    # yet (first run), which is fine.
    pnpm dlx vercel@latest env rm "$name" "$env" --yes \
      --token "$VERCEL_TOKEN_NEW" --scope "$TEAM" >/dev/null 2>&1 || true
    printf '%s' "$value" | pnpm dlx vercel@latest env add "$name" "$env" \
      --token "$VERCEL_TOKEN_NEW" --scope "$TEAM" >/dev/null
    echo "  set $name [$env]"
  done
}

# Link the working directory to the project so `vercel env` knows which
# project to target. Only needs to happen once per machine.
if [ ! -f ".vercel/project.json" ]; then
  pnpm dlx vercel@latest link --project "$PROJECT" --scope "$TEAM" \
    --token "$VERCEL_TOKEN_NEW" --yes
fi

echo "Setting required env vars on $PROJECT…"
set_env "DATABASE_URL"               "$DATABASE_URL"
set_env "DIRECT_URL"                 "$DIRECT_URL"
set_env "NEXT_PUBLIC_SUPABASE_URL"   "$SUPABASE_URL"
set_env "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$SUPABASE_ANON_KEY"
set_env "SUPABASE_SERVICE_ROLE_KEY"  "$SUPABASE_SERVICE_ROLE"
set_env "NEXT_PUBLIC_SITE_URL"       "$SITE_URL"

echo ""
echo "Done. Trigger a redeploy:"
echo "  pnpm dlx vercel@latest --prod --token \$VERCEL_TOKEN --scope $TEAM"
echo ""
echo "Or push any commit to main and Vercel will redeploy automatically."
