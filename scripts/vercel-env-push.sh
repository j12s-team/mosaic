#!/usr/bin/env bash
# Push a local env file into a Vercel project's Production environment.
#
# Vercel deployments read env from Vercel's own store, NOT from any file in
# the repo. This script bulk-loads a gitignored .env.production.local into
# the linked Vercel project so the deployed app has the values.
#
# Usage (run once per app dir, after `vercel link` in that dir):
#   cd apps/app  && ../../scripts/vercel-env-push.sh .env.production.local production
#   cd apps/site && ../../scripts/vercel-env-push.sh .env.production.local production
#
# Requires: npm i -g vercel  &&  vercel login  &&  vercel link (in the app dir)

set -euo pipefail
FILE="${1:-.env.production.local}"
ENVIRONMENT="${2:-production}"

[ -f "$FILE" ] || { echo "No such file: $FILE"; exit 1; }
command -v vercel >/dev/null || { echo "Install the Vercel CLI: npm i -g vercel"; exit 1; }

echo "Pushing $FILE → Vercel ($ENVIRONMENT) for the project linked in $(pwd)"
while IFS= read -r line || [ -n "$line" ]; do
  # skip blanks and comments
  [[ -z "${line// }" || "$line" =~ ^[[:space:]]*# ]] && continue
  key="${line%%=*}"
  val="${line#*=}"
  [[ -z "$key" ]] && continue
  # remove an existing value first so re-runs are idempotent (ignore errors)
  vercel env rm "$key" "$ENVIRONMENT" -y >/dev/null 2>&1 || true
  printf '%s' "$val" | vercel env add "$key" "$ENVIRONMENT" >/dev/null
  echo "  set $key"
done < "$FILE"
echo "Done. Redeploy for changes to take effect: vercel --prod"
