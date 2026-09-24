#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PKG="$(cd "$(dirname "$0")/.." && pwd)"
PORTFILE=$(mktemp); rm -f "$PORTFILE"
node "$ROOT/examples/_receiver/receiver.mjs" --port-file "$PORTFILE" --service python-owlpane --span hello-owlpane --timeout 90 & RPID=$!
trap 'kill $RPID 2>/dev/null || true' EXIT
until [ -s "$PORTFILE" ]; do sleep 0.2; done
export OTEL_EXPORTER_OTLP_ENDPOINT="http://127.0.0.1:$(cat "$PORTFILE")"
export OWLPANE_INGEST_KEY="owl_ing_test_local_key000000000000000000000000"
export OTEL_SERVICE_NAME=python-owlpane
export OWLPANE_ENVIRONMENT=production
cd "$PKG"
[ -d .venv ] || python3 -m venv .venv
.venv/bin/pip install -q -e ".[dev]"
.venv/bin/python -m owlpane_conformance
wait $RPID
