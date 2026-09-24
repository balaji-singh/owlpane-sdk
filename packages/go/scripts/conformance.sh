#!/usr/bin/env bash
# Sends one span via owlpane-go to the throwaway receiver (same contract as examples/go/run.sh).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PKG="$(cd "$(dirname "$0")/.." && pwd)"
PORTFILE=$(mktemp); rm -f "$PORTFILE"
node "$ROOT/examples/_receiver/receiver.mjs" --port-file "$PORTFILE" --service go-owlpane --span hello-owlpane --timeout 90 & RPID=$!
trap 'kill $RPID 2>/dev/null || true' EXIT
until [ -s "$PORTFILE" ]; do sleep 0.2; done
export OTEL_EXPORTER_OTLP_ENDPOINT="http://127.0.0.1:$(cat "$PORTFILE")"
export OWLPANE_INGEST_KEY="owl_ing_test_local_key000000000000000000000000"
export OTEL_SERVICE_NAME=go-owlpane
export OWLPANE_ENVIRONMENT=production
cd "$PKG"
go run ./cmd/conformance/
wait $RPID
