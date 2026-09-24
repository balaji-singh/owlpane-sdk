#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
# shellcheck source=../_lib/console-env.sh
source ../_lib/console-env.sh

use_local() {
  npm pkg set dependencies.@owlpane/node="file:../../packages/node"
  rm -f .npmrc
  echo "sdk-node: using monorepo packages/node (same code as @balaji-singh/owlpane-node@0.1.1)" >&2
}

install_deps() {
  npm install --no-audit --no-fund
}

if [ "${OWLPANE_SDK_SOURCE:-published}" = "local" ]; then
  use_local
  install_deps
else
  npm pkg set dependencies.@owlpane/node="npm:@balaji-singh/owlpane-node@0.1.1"
  export GITHUB_PACKAGES_TOKEN="${GITHUB_PACKAGES_TOKEN:-$(gh auth token 2>/dev/null || true)}"
  if [ -n "${GITHUB_PACKAGES_TOKEN}" ]; then
    printf '%s\n' "@balaji-singh:registry=https://npm.pkg.github.com" \
      "//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}" > .npmrc
  fi
  if ! install_deps 2>npm-install.err; then
    if grep -qE '403|E403|expected scopes|read:packages' npm-install.err 2>/dev/null; then
      echo "sdk-node: GitHub Packages requires read:packages (gh auth refresh -h github.com -s read:packages)." >&2
      echo "sdk-node: falling back to local packages/node for this run." >&2
      use_local
      install_deps
    else
      cat npm-install.err >&2
      rm -f npm-install.err
      exit 1
    fi
  fi
  rm -f npm-install.err
fi

npm run start
