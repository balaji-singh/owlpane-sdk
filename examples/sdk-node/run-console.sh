#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
# shellcheck source=../_lib/console-env.sh
source ../_lib/console-env.sh
if [ "${OWLPANE_SDK_SOURCE:-published}" = "local" ]; then
  npm pkg set dependencies.@balaji-singh/owlpane-node="file:../../packages/node"
fi
if [ -z "${GITHUB_PACKAGES_TOKEN:-}" ] && [ "${OWLPANE_SDK_SOURCE:-published}" != "local" ]; then
  if ! command -v gh >/dev/null 2>&1; then
    echo "Set GITHUB_PACKAGES_TOKEN or OWLPANE_SDK_SOURCE=local" >&2
    exit 1
  fi
  export GITHUB_PACKAGES_TOKEN="$(gh auth token)"
fi
npm install --no-audit --no-fund
npm run start
