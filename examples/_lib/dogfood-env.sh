#!/usr/bin/env bash
# Load shared ingest settings + per-app onboarding (project key + service.name).
# Usage: source "$(dirname "$0")/dogfood-env.sh" <app-id>   # node | go | python | java | ruby
set -euo pipefail

_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-${0}}")" && pwd)"
_EXAMPLES_ROOT="$(cd "${_LIB_DIR}/.." && pwd)"
if [ -f "$_EXAMPLES_ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$_EXAMPLES_ROOT/.env"
  set +a
fi

APP_ID="${1:-}"
if [ -z "$APP_ID" ]; then
  echo "dogfood-env.sh: missing app id (node, go, python, java, ruby)" >&2
  return 1 2>/dev/null || exit 1
fi

MANIFEST="$_EXAMPLES_ROOT/dogfood.manifest.json"
if [ ! -f "$MANIFEST" ]; then
  echo "Missing $MANIFEST" >&2
  return 1 2>/dev/null || exit 1
fi

read_manifest() {
  node -e "
const fs = require('fs');
const apps = JSON.parse(fs.readFileSync('${MANIFEST}', 'utf8')).apps;
const app = apps.find((a) => a.id === '${APP_ID}');
if (!app) { console.error('Unknown app id: ${APP_ID}'); process.exit(1); }
process.stdout.write(JSON.stringify(app));
"
}

APP_JSON="$(read_manifest)"
PROJECT="$(node -e "process.stdout.write(JSON.parse(process.argv[1]).project)" "$APP_JSON")"
KEY_ENV="$(node -e "process.stdout.write(JSON.parse(process.argv[1]).ingestKeyEnv)" "$APP_JSON")"

ENDPOINT="${OWLPANE_INGEST_URL:-${OWLPANE_ENDPOINT:-}}"
if [ -z "$ENDPOINT" ]; then
  echo "Set OWLPANE_INGEST_URL in examples/.env" >&2
  return 1 2>/dev/null || exit 1
fi

KEY="${!KEY_ENV:-}"
if [ -z "$KEY" ]; then
  echo "Missing ${KEY_ENV}. Run: ./scripts/onboard-dogfood.sh --write-env" >&2
  return 1 2>/dev/null || exit 1
fi
API_ENV="${_EXAMPLES_ROOT}/../../api/apps/api/.env"
if ! [[ "$KEY" =~ ^owl_ing_[a-f0-9]{48}$ ]] && [ -f "$API_ENV" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$API_ENV"
  set +a
  KEY="${!KEY_ENV:-}"
  if [ -z "$KEY" ]; then
    KEY="${OWLPANE_INGEST_KEY:-}"
  fi
  if [ -n "$KEY" ]; then
    echo "Using ingest key from ${API_ENV} for ${PROJECT}" >&2
  fi
fi
if ! [[ "${KEY}" =~ ^owl_ing_[a-f0-9]{48}$ ]]; then
  echo "Invalid ingest key for ${PROJECT} (need owl_ing_ + 48 hex from console)." >&2
  return 1 2>/dev/null || exit 1
fi

export OWLPANE_INGEST_URL="${ENDPOINT%/}"
export OWLPANE_INGEST_KEY="$KEY"
export OWLPANE_ENVIRONMENT="${OWLPANE_ENVIRONMENT:-development}"
export OTEL_SERVICE_NAME="$PROJECT"
export OTEL_EXPORTER_OTLP_ENDPOINT="$OWLPANE_INGEST_URL"
export OTEL_EXPORTER_OTLP_PROTOCOL="${OTEL_EXPORTER_OTLP_PROTOCOL:-http/protobuf}"
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer%20${OWLPANE_INGEST_KEY}"

# Runtime boards: Server span + language tag (merge with SDK resource).
case "$APP_ID" in
  go) LANG_ATTR="telemetry.sdk.language=go" ;;
  python) LANG_ATTR="telemetry.sdk.language=python" ;;
  java) LANG_ATTR="telemetry.sdk.language=java" ;;
  ruby) LANG_ATTR="telemetry.sdk.language=ruby" ;;
  node) LANG_ATTR="telemetry.sdk.language=nodejs" ;;
  *) LANG_ATTR="" ;;
esac
BASE_ATTRS="deployment.environment.name=${OWLPANE_ENVIRONMENT},service.version=0.1.1"
if [ -n "$LANG_ATTR" ]; then
  export OTEL_RESOURCE_ATTRIBUTES="${BASE_ATTRS},${LANG_ATTR}"
else
  export OTEL_RESOURCE_ATTRIBUTES="${BASE_ATTRS}"
fi

export OWLPANE_DOGFOOD_APP_ID="$APP_ID"
export OWLPANE_DOGFOOD_PROJECT="$PROJECT"
