#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
# shellcheck source=../../_lib/dogfood-env.sh
source ../../_lib/dogfood-env.sh node

export GITHUB_PACKAGES_TOKEN="${GITHUB_PACKAGES_TOKEN:-$(gh auth token 2>/dev/null || true)}"
if [ -z "${GITHUB_PACKAGES_TOKEN}" ]; then
  echo "GitHub Packages npm needs a token: gh auth refresh -h github.com -s read:packages" >&2
  exit 1
fi
printf '%s\n' "@balaji-singh:registry=https://npm.pkg.github.com" \
  "//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}" > .npmrc

npm install --no-audit --no-fund
npm run start
