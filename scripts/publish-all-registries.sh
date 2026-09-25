#!/usr/bin/env bash
# Called from publish-sdk.yml after build+test. Publishes every language artifact.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
OWNER="${GITHUB_REPOSITORY%%/*}"
VERSION="$(node -p "require('./packages/node/package.json').version")"
TOKEN="${PACKAGES_TOKEN:-${GITHUB_TOKEN:-}}"
REGISTRY_NPMJS="https://registry.npmjs.org"
FAILED=()

npm_userconfig() {
  # actions/setup-node sets NPM_CONFIG_USERCONFIG; appending only to ~/.npmrc is ignored in CI.
  echo "${NPM_CONFIG_USERCONFIG:-${HOME}/.npmrc}"
}

ensure_npmjs_auth() {
  local npmrc token
  npmrc="$(npm_userconfig)"
  token="${NODE_AUTH_TOKEN:-${NPM_TOKEN:-}}"
  if [ -z "$token" ]; then
    return 1
  fi
  mkdir -p "$(dirname "$npmrc")"
  if ! grep -q '//registry.npmjs.org/:_authToken=' "$npmrc" 2>/dev/null; then
    echo "//registry.npmjs.org/:_authToken=${token}" >> "$npmrc"
  fi
  if ! grep -q '@owlpane:registry=' "$npmrc" 2>/dev/null; then
    echo '@owlpane:registry=https://registry.npmjs.org/' >> "$npmrc"
  fi
}

publish_npmjs() {
  local dir="$1"
  local name
  name="$(node -p "require('./${dir}/package.json').name")"
  if npm view "${name}@${VERSION}" version --registry "${REGISTRY_NPMJS}" >/dev/null 2>&1; then
    echo "npmjs: ${name}@${VERSION} already published"
    return 0
  fi
  echo "npmjs: publishing ${name}@${VERSION} as $(npm whoami --registry "${REGISTRY_NPMJS}" 2>/dev/null || echo unknown)"
  if ! (cd "$dir" && npm publish --access public --registry "${REGISTRY_NPMJS}"); then
    echo "::error::npm publish failed for ${name}@${VERSION} (404 usually means NPM_TOKEN user lacks access to scope ${name%%/*})"
    return 1
  fi
  echo "npmjs: published ${name}@${VERSION}"
}

if [ -n "${NODE_AUTH_TOKEN:-${NPM_TOKEN:-}}" ]; then
  if ! ensure_npmjs_auth; then
    echo "::error::npm auth config failed"
    FAILED+=("npm-auth")
  elif ! npm whoami --registry "${REGISTRY_NPMJS}" >/dev/null 2>&1; then
    echo "::error::npm whoami failed — check NPM_TOKEN / NODE_AUTH_TOKEN (granular token needs publish on @owlpane/*)"
    FAILED+=("npm-whoami")
  else
    echo "npmjs: authenticated as $(npm whoami --registry "${REGISTRY_NPMJS}")"
    if ! publish_npmjs packages/node; then FAILED+=("npm-node"); fi
    if ! publish_npmjs packages/browser; then FAILED+=("npm-browser"); fi
  fi
else
  echo "::error::NPM_TOKEN unset — cannot publish @owlpane/* to registry.npmjs.org"
  FAILED+=("npm-missing-token")
fi

if [ -z "$TOKEN" ]; then
  echo "::warning::No PACKAGES_TOKEN or GITHUB_TOKEN — skipping GitHub Packages (Maven/Ruby)"
else
  export NODE_AUTH_TOKEN="$TOKEN"
  export PACKAGES_TOKEN="$TOKEN"
fi

python -m pip install -q --upgrade pip build twine
if ! (cd packages/python && python -m build); then FAILED+=("python-build"); fi
if [ -n "${PYPI_API_TOKEN:-}" ]; then
  if ! (cd packages/python && twine upload dist/* --non-interactive --skip-existing -u __token__ -p "${PYPI_API_TOKEN}"); then
    FAILED+=("pypi")
  fi
else
  echo "::warning::PYPI_API_TOKEN unset — skipping pypi.org"
fi

if [ -n "$TOKEN" ]; then
  MAVEN_SETTINGS="$(mktemp)"
  cat > "${MAVEN_SETTINGS}" <<EOF
<settings xmlns="http://maven.apache.org/SETTINGS/1.2.0">
  <servers>
    <server>
      <id>github</id>
      <username>x-access-token</username>
      <password>${TOKEN}</password>
    </server>
  </servers>
</settings>
EOF
  if ! (cd packages/java && mvn -q -s "${MAVEN_SETTINGS}" test package deploy); then
    if mvn -q -s "${MAVEN_SETTINGS}" help:evaluate -Dexpression=project.version -DforceStdout 2>/dev/null | grep -q .; then
      echo "::warning::Maven deploy failed (often 409 if ${VERSION} already on GitHub Packages) — continuing"
    else
      FAILED+=("maven")
    fi
  fi
  rm -f "${MAVEN_SETTINGS}"

  if ! (
    cd packages/ruby
    gem build owlpane.gemspec
    mkdir -p "${HOME}/.gem"
    printf '%s\n' "---" ":github: Bearer ${TOKEN}" > "${HOME}/.gem/credentials"
    chmod 600 "${HOME}/.gem/credentials"
    gem push --key github --host "https://rubygems.pkg.github.com/${OWNER}" "owlpane-${VERSION}.gem"
  ); then
    echo "::warning::Ruby gem push failed (often already pushed) — continuing"
  fi
else
  echo "::warning::Skipping Maven and Ruby GitHub Packages (no token)"
fi

mkdir -p dist/release-assets
cp -f packages/python/dist/* dist/release-assets/ 2>/dev/null || true
cp -f packages/java/target/owlpane-java-*.jar dist/release-assets/ 2>/dev/null || true
cp -f packages/ruby/owlpane-*.gem dist/release-assets/ 2>/dev/null || true

GO_TAG="packages/go/v${VERSION}"
if ! git rev-parse "${GO_TAG}" >/dev/null 2>&1; then
  git config user.name "github-actions[bot]"
  git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
  git tag -a "${GO_TAG}" -m "Go module release v${VERSION}"
  if ! git push origin "${GO_TAG}"; then FAILED+=("go-tag"); fi
else
  echo "go: tag ${GO_TAG} exists"
fi

TAG="sdk-v${VERSION}"
NOTES_FILE="$(mktemp)"
{
  echo "## Owlpane SDK v${VERSION}"
  echo ""
  echo "| Language | Install |"
  echo "|----------|---------|"
  echo "| Node | \`npm install @owlpane/node@${VERSION}\` |"
  echo "| Browser | \`npm install @owlpane/browser@${VERSION}\` |"
  echo "| Python | pip install owlpane==${VERSION} |"
  echo "| Go | go get github.com/balaji-singh/owlpane-sdk/packages/go@v${VERSION} |"
  echo "| Java | com.owlpane:owlpane-java:${VERSION} (Maven, GitHub Packages) |"
  echo "| Ruby | gem install owlpane -v ${VERSION} |"
} > "${NOTES_FILE}"

if gh release view "${TAG}" --repo "${GITHUB_REPOSITORY}" >/dev/null 2>&1; then
  gh release edit "${TAG}" --repo "${GITHUB_REPOSITORY}" --notes-file "${NOTES_FILE}"
else
  gh release create "${TAG}" --repo "${GITHUB_REPOSITORY}" --title "SDK v${VERSION}" --notes-file "${NOTES_FILE}"
fi
if [ -d dist/release-assets ] && compgen -G "dist/release-assets/*" > /dev/null; then
  if ! gh release upload "${TAG}" --repo "${GITHUB_REPOSITORY}" dist/release-assets/* --clobber; then
    FAILED+=("release-assets")
  fi
fi

# npm is required for SaaS customers; other registries are best-effort on re-runs.
if [ "${#FAILED[@]}" -gt 0 ] && printf '%s\n' "${FAILED[@]}" | grep -qE 'npm'; then
  echo "::error::npm publish failed: ${FAILED[*]}"
  echo "::error::npm publish/auth failed: ${FAILED[*]} (ensure repo secret NPM_TOKEN is set; CI must pass NODE_AUTH_TOKEN for setup-node)"
  exit 1
fi
if [ "${#FAILED[@]}" -gt 0 ]; then
  echo "::warning::Non-npm publish issues: ${FAILED[*]}"
fi
echo "All registries published for v${VERSION}"
