#!/usr/bin/env bash
# Starts every service of the example estate against a running Owlpane ingest gateway.
#   OWLPANE_ENDPOINT=http://127.0.0.1:4319 KEYS_JSON=keys.json ESTATE_DB=postgres://... ./run.sh
# KEYS_JSON maps each project name to {"key": "owl_ing_..."} as returned when the project was created.
set -euo pipefail
cd "$(dirname "$0")"
: "${OWLPANE_ENDPOINT:?ingest URL}" "${KEYS_JSON:?path to keys json}" "${ESTATE_DB:?postgres url}"
key() { python3 -c "import json,sys;print(json.load(open('$KEYS_JSON'))['$1']['key'])"; }
LOGS="${ESTATE_LOGS:-/tmp/owlpane-estate}"; mkdir -p "$LOGS"
export OWLPANE_ENDPOINT ESTATE_DB
export SCORES_URL=http://127.0.0.1:5101 STATS_URL=http://127.0.0.1:5102 PAYMENTS_URL=http://127.0.0.1:5103 LEDGER_URL=http://127.0.0.1:5104

(cd scores && [ -d node_modules ] || npm install --no-audit --no-fund >/dev/null)
OWLPANE_INGEST_KEY=$(key "Scores service (Node)") node scores/server.cjs >"$LOGS/scores.log" 2>&1 &
[ -d stats/.venv ] || { python3 -m venv stats/.venv; stats/.venv/bin/pip install -q -r stats/requirements.txt; }
OTEL_EXPORTER_OTLP_ENDPOINT="$OWLPANE_ENDPOINT" OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf \
  OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer%20$(key "Stats service (Python)")" OTEL_SERVICE_NAME=stats-service \
  OTEL_RESOURCE_ATTRIBUTES=deployment.environment.name=production,service.version=1.3.0 OTEL_LOGS_EXPORTER=otlp OTEL_PYTHON_LOGGING_AUTO_INSTRUMENTATION_ENABLED=true \
  stats/.venv/bin/opentelemetry-instrument stats/.venv/bin/python stats/app.py >"$LOGS/stats.log" 2>&1 &
(cd payments && [ -f go.sum ] || go mod tidy >/dev/null 2>&1; go build -o payments . ) 
OTEL_EXPORTER_OTLP_ENDPOINT="$OWLPANE_ENDPOINT" OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer $(key "Payments service (Go)")" payments/payments >"$LOGS/payments.log" 2>&1 &
JAR=../java/lib/opentelemetry-javaagent.jar
[ -f "$JAR" ] || curl -fsSL -o "$JAR" https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/latest/download/opentelemetry-javaagent.jar
(cd ledger && javac -d out Ledger.java)
OTEL_EXPORTER_OTLP_ENDPOINT="$OWLPANE_ENDPOINT" OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer $(key "Ledger service (Java)")" \
  OTEL_SERVICE_NAME=ledger-service OTEL_RESOURCE_ATTRIBUTES=deployment.environment.name=production,service.version=0.9.4 OTEL_LOGS_EXPORTER=otlp \
  java -javaagent:$JAR -cp ledger/out Ledger >"$LOGS/ledger.log" 2>&1 &
# The SDK is installed as a real copy (not a symlink) so it patches the same @nestjs/schedule the app loads.
(cd bff && [ -d node_modules ] || npm install --install-links --no-audit --no-fund >/dev/null; ../../../node_modules/.bin/tsc -p tsconfig.json)
(cd scores && [ -d node_modules ] || npm install --no-audit --no-fund >/dev/null)
OWLPANE_INGEST_KEY=$(key "Demo BFF (NestJS)") node bff/dist/main.js >"$LOGS/bff.log" 2>&1 &
OWLPANE_INGEST_KEY=$(key "Storefront (browser)") OWLPANE_PUBLIC_ENDPOINT="$OWLPANE_ENDPOINT" BFF_PUBLIC_URL=http://127.0.0.1:5100 node storefront/server.mjs >"$LOGS/storefront.log" 2>&1 &
sleep 8
echo "estate running. logs in $LOGS. storefront: http://127.0.0.1:5180  bff: http://127.0.0.1:5100"
node loadgen.mjs
