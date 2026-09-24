#!/usr/bin/env bash
# Optional: send one OTLP HTTP span to a real ingest URL. Not used by package conformance (local receiver).
set -euo pipefail
: "${OWLPANE_INGEST_URL:?}"
: "${OWLPANE_INGEST_KEY:?}"
TRACE=$(python3 -c 'import uuid; print(uuid.uuid4().hex)')
SPAN=$(python3 -c 'import uuid; print(uuid.uuid4().hex[:16])')
NOW=$(python3 -c 'import time; print(int(time.time()*1e9))')
BODY=$(cat <<EOF
{"resourceSpans":[{"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"owlpane-sdk-smoke"}}]},"scopeSpans":[{"spans":[{"traceId":"${TRACE}","spanId":"${SPAN}","name":"smoke","kind":2,"startTimeUnixNano":"${NOW}","endTimeUnixNano":"${NOW}"}]}]}]}
EOF
)
CODE=$(curl -sS -o /tmp/owlpane-smoke-body -w "%{http_code}" -X POST "${OWLPANE_INGEST_URL%/}/v1/traces" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${OWLPANE_INGEST_KEY}" \
  --data "$BODY")
echo "ingest status $CODE"
test "$CODE" = "200"
echo "real-cell-smoke ok trace=$TRACE"
