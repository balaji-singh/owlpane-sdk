#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
# shellcheck source=../_lib/console-env.sh
source ../_lib/console-env.sh
# Default local monorepo package; set OWLPANE_SDK_SOURCE=published + GITHUB_PACKAGES_TOKEN for GitHub Packages.
if [ "${OWLPANE_SDK_SOURCE:-local}" = "local" ]; then
  npm pkg set dependencies.@owlpane/node="file:../../packages/node"
else
  npm pkg set dependencies.@owlpane/node="npm:@balaji-singh/owlpane-node@0.1.1"
  if [ -z "${GITHUB_PACKAGES_TOKEN:-}" ]; then
    if command -v gh >/dev/null 2>&1; then
      export GITHUB_PACKAGES_TOKEN="$(gh auth token)"
    fi
  fi
  if [ -z "${GITHUB_PACKAGES_TOKEN:-}" ]; then
    echo "For published npm: export GITHUB_PACKAGES_TOKEN=... (PAT with read:packages) or gh auth refresh -s read:packages" >&2
    exit 1
  fi
fi
npm install --no-audit --no-fund
npm run start
