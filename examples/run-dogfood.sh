#!/usr/bin/env bash
# Emit one Server span per language using published SDKs / OTel — standard SaaS onboarding.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
chmod +x "$ROOT/run-dogfood.sh" "$ROOT/_lib/dogfood-env.sh" "$ROOT"/apps/*/run.sh 2>/dev/null || true
export OWLPANE_SDK_SOURCE=published

if [ ! -f "$ROOT/.env" ] || ! grep -q '^OWLPANE_INGEST_KEY_NODE=owl_ing_' "$ROOT/.env" 2>/dev/null; then
  echo "Onboarding SDK example projects via API (Projects & keys)…" >&2
  "$ROOT/scripts/onboard-dogfood.sh" --write-env
fi

# shellcheck source=_lib/dogfood-env.sh
source "$ROOT/_lib/dogfood-env.sh" node
echo "Ingest ${OWLPANE_INGEST_URL} · env ${OWLPANE_ENVIRONMENT}"
echo "Create one console project per app (see dogfood.manifest.json)."
echo ""

run_app() {
  local id="$1"
  echo "=== ${id} ==="
  (cd "$ROOT/apps/$id" && chmod +x run.sh && ./run.sh)
}

run_app node
run_app go
run_app python
run_app java
run_app ruby
echo ""
echo "Done. Console → Applications (per runtime) or Traces · filter by service owlpane-sdk-* · env ${OWLPANE_ENVIRONMENT:-development}."
