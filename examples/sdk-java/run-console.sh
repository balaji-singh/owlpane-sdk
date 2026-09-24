#!/usr/bin/env bash
# OpenTelemetry Java agent + API jars (Owlpane thin Java library not on Maven yet).
set -euo pipefail
cd "$(dirname "$0")"
# shellcheck source=../_lib/console-env.sh
source ../_lib/console-env.sh
mkdir -p lib out
[ -f lib/opentelemetry-javaagent.jar ] || curl -fsSL -o lib/opentelemetry-javaagent.jar \
  https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/latest/download/opentelemetry-javaagent.jar
API_VER=1.49.0
[ -f lib/opentelemetry-api.jar ] || curl -fsSL -o lib/opentelemetry-api.jar \
  "https://repo1.maven.org/maven2/io/opentelemetry/opentelemetry-api/$API_VER/opentelemetry-api-$API_VER.jar"
[ -f lib/opentelemetry-context.jar ] || curl -fsSL -o lib/opentelemetry-context.jar \
  "https://repo1.maven.org/maven2/io/opentelemetry/opentelemetry-context/$API_VER/opentelemetry-context-$API_VER.jar"
CP=lib/opentelemetry-api.jar:lib/opentelemetry-context.jar
javac -cp "$CP" -d out ../java/App.java
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer%20${OWLPANE_INGEST_KEY}"
export OTEL_RESOURCE_ATTRIBUTES="deployment.environment.name=${OWLPANE_ENVIRONMENT},service.version=1.0.0"
export OTEL_METRICS_EXPORTER=none OTEL_LOGS_EXPORTER=none
java -javaagent:lib/opentelemetry-javaagent.jar -cp "out:$CP" App
echo "span emitted (check Owlpane console)"
