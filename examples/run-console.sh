#!/usr/bin/env bash
# Run all published-SDK examples against examples/.env (local Owlpane ingest + console).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=_lib/console-env.sh
source "$ROOT/_lib/console-env.sh"
echo "Using ingest ${OWLPANE_INGEST_URL} service=${OTEL_SERVICE_NAME}"

run() {
  local name="$1"
  echo "=== $name ==="
  (cd "$ROOT/$name" && ./run-console.sh)
}

run sdk-go
run sdk-python
run sdk-java
run sdk-node
echo "All console examples finished."
