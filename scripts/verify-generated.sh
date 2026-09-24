#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm run codegen
if ! git diff --exit-code packages/go/owlpane/zz_generated_env.go packages/python/owlpane/_generated_config.py schema/install-snippets.json; then
  echo "generated files out of date — run npm run codegen and commit"
  exit 1
fi
echo "verify-generated: ok"
