#!/usr/bin/env bash
# Start the PII canary against a running Owlpane ingest gateway.
#   OWLPANE_ENDPOINT=http://127.0.0.1:4319 OWLPANE_INGEST_KEY=owl_ing_... ./run.sh
set -euo pipefail
cd "$(dirname "$0")"
if [ -f ../.env ]; then set -a; # shellcheck disable=SC1091
  source ../.env; set +a; fi
: "${OWLPANE_INGEST_KEY:?set OWLPANE_INGEST_KEY in examples/.env or env}"
export OWLPANE_ENDPOINT="${OWLPANE_ENDPOINT:-${OWLPANE_INGEST_URL:-}}"
: "${OWLPANE_ENDPOINT:?set OWLPANE_INGEST_URL or OWLPANE_ENDPOINT}"
export OWLPANE_ENVIRONMENT="${OWLPANE_ENVIRONMENT:-development}"
if [ "${OWLPANE_SDK_SOURCE:-published}" = "local" ]; then
  npm pkg set dependencies.@owlpane/node="file:../../packages/node"
elif [ -f .npmrc.ghpackages ]; then
  cp .npmrc.ghpackages .npmrc
  export GITHUB_PACKAGES_TOKEN="${GITHUB_PACKAGES_TOKEN:-$(gh auth token 2>/dev/null || true)}"
fi
[ -d node_modules ] || npm install --install-links --no-audit --no-fund
npm run start
