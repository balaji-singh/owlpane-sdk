#!/usr/bin/env bash
# Source from examples/*/run-console.sh — loads examples/.env and normalizes OTLP env.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi
if [ -z "${OWLPANE_INGEST_KEY:-}" ]; then
  echo "Missing OWLPANE_INGEST_KEY. Copy examples/.env.console.example to examples/.env" >&2
  exit 1
fi
if [[ "${OWLPANE_INGEST_KEY}" == *your_project_key* ]] || ! [[ "${OWLPANE_INGEST_KEY}" =~ ^owl_ing_[a-f0-9]{48}$ ]]; then
  echo "Invalid OWLPANE_INGEST_KEY in examples/.env." >&2
  echo "Copy the project ingest key from Owlpane console (format: owl_ing_ + 48 hex chars)." >&2
  echo "Local API dev often has OWLPANE_INGEST_KEY in owlpane/api/apps/api/.env" >&2
  exit 1
fi
ENDPOINT="${OWLPANE_INGEST_URL:-${OWLPANE_ENDPOINT:-}}"
if [ -z "$ENDPOINT" ]; then
  echo "Set OWLPANE_INGEST_URL or OWLPANE_ENDPOINT in examples/.env" >&2
  exit 1
fi
export OWLPANE_INGEST_URL="${ENDPOINT%/}"
export OWLPANE_INGEST_KEY
export OWLPANE_ENVIRONMENT="${OWLPANE_ENVIRONMENT:-development}"
export OTEL_SERVICE_NAME="${OTEL_SERVICE_NAME:-owlpane-sdk-example}"
export OTEL_EXPORTER_OTLP_ENDPOINT="$OWLPANE_INGEST_URL"
export OTEL_EXPORTER_OTLP_PROTOCOL="${OTEL_EXPORTER_OTLP_PROTOCOL:-http/protobuf}"
# Java agent / raw OTel samples read headers from env, not OWLPANE_INGEST_KEY.
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer%20${OWLPANE_INGEST_KEY}"
