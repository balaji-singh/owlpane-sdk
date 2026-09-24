#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
# shellcheck source=../_lib/console-env.sh
source ../_lib/console-env.sh

if [ "${OWLPANE_SDK_SOURCE:-published}" = "local" ]; then
  npm pkg set dependencies.@owlpane/node="file:../../packages/node"
else
  npm pkg set dependencies.@owlpane/node="npm:@balaji-singh/owlpane-node@0.1.1"
  export GITHUB_PACKAGES_TOKEN="${GITHUB_PACKAGES_TOKEN:-$(gh auth token 2>/dev/null || true)}"
  if [ -z "${GITHUB_PACKAGES_TOKEN}" ]; then
    echo "GitHub Packages npm needs a token with read:packages." >&2
    echo "  gh auth refresh -h github.com -s read:packages" >&2
    echo "  or export GITHUB_PACKAGES_TOKEN=ghp_..." >&2
    echo "  or OWLPANE_SDK_SOURCE=local for file:../../packages/node" >&2
    exit 1
  fi
  printf '%s\n' "@balaji-singh:registry=https://npm.pkg.github.com" \
    "//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}" > .npmrc
fi

npm install --no-audit --no-fund
npm run start
