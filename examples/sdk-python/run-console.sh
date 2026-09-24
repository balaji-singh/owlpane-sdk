#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
# shellcheck source=../_lib/console-env.sh
source ../_lib/console-env.sh
[ -d .venv ] || python3 -m venv .venv
if [ "${OWLPANE_SDK_SOURCE:-published}" = "local" ]; then
  .venv/bin/pip install -q -e ../../../packages/python
else
  .venv/bin/pip install -q -r requirements.txt
fi
.venv/bin/python app.py
