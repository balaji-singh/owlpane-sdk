#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
# shellcheck source=../../_lib/dogfood-env.sh
source ../../_lib/dogfood-env.sh ruby
bundle config set --local path vendor/bundle
bundle install --quiet
bundle exec ruby app.rb
