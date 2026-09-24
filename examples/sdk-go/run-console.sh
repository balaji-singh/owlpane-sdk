#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
# shellcheck source=../_lib/console-env.sh
source ../_lib/console-env.sh
if [ "${OWLPANE_SDK_SOURCE:-published}" = "local" ]; then
  go mod edit -replace=github.com/balaji-singh/owlpane-sdk/packages/go=../../packages/go
fi
go mod tidy
go run .
