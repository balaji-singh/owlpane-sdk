#!/usr/bin/env bash
# Start the PII canary against a running Owlpane ingest gateway.
#   OWLPANE_ENDPOINT=http://127.0.0.1:4319 OWLPANE_INGEST_KEY=owl_ing_... ./run.sh
set -euo pipefail
cd "$(dirname "$0")"
: "${OWLPANE_ENDPOINT:?set ingest URL}" "${OWLPANE_INGEST_KEY:?set project ingest key}"
export OWLPANE_ENVIRONMENT="${OWLPANE_ENVIRONMENT:-development}"
[ -d node_modules ] || npm install --install-links --no-audit --no-fund
npm run start
