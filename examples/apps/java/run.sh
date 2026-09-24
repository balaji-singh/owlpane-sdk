#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
# shellcheck source=../../_lib/dogfood-env.sh
source ../../_lib/dogfood-env.sh java
mkdir -p lib out
[ -f lib/opentelemetry-javaagent.jar ] || curl -fsSL -o lib/opentelemetry-javaagent.jar \
  https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/latest/download/opentelemetry-javaagent.jar
API_VER=1.49.0
[ -f lib/opentelemetry-api.jar ] || curl -fsSL -o lib/opentelemetry-api.jar \
  "https://repo1.maven.org/maven2/io/opentelemetry/opentelemetry-api/$API_VER/opentelemetry-api-$API_VER.jar"
[ -f lib/opentelemetry-context.jar ] || curl -fsSL -o lib/opentelemetry-context.jar \
  "https://repo1.maven.org/maven2/io/opentelemetry/opentelemetry-context/$API_VER/opentelemetry-context-$API_VER.jar"
CP=lib/opentelemetry-api.jar:lib/opentelemetry-context.jar
javac -cp "$CP" -d out App.java
export OTEL_METRICS_EXPORTER=none OTEL_LOGS_EXPORTER=none
java -javaagent:lib/opentelemetry-javaagent.jar -cp "out:$CP" App
echo "span emitted (${OTEL_SERVICE_NAME})"
