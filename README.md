# Owlpane SDK

Customer-facing packages:

- `@owlpane/node` — `packages/node` (full) — **[npmjs.com](https://www.npmjs.com/package/@owlpane/node)**
- `@owlpane/browser` — `packages/browser` (full) — **[npmjs.com](https://www.npmjs.com/package/@owlpane/browser)**
- `github.com/balaji-singh/owlpane-sdk/packages/go` — `packages/go` (thin, generated env + hand OTel)
- `owlpane` (PyPI-style) — `packages/python` (thin)
- Java / Ruby / .NET — **planned** thin starters (see multi-language architecture)

**Multi-language design:** [docs/MULTILANGUAGE-SDK-ARCHITECTURE.md](docs/MULTILANGUAGE-SDK-ARCHITECTURE.md)  
**Contract (codegen source of truth):** [schema/sdk-contract.schema.json](schema/sdk-contract.schema.json)

**Release (`sdk-v*` tag):** one workflow publishes **all** languages:

| Language | Registry |
|----------|----------|
| Node, Browser | **npmjs.com** (`@owlpane/node`, `@owlpane/browser`) — requires `NPM_TOKEN` |
| Python | PyPI (`owlpane`) if `PYPI_API_TOKEN` + wheel on GitHub Release |
| Go | Git tag `packages/go/v*` |
| Java | GitHub Packages Maven (`com.owlpane:owlpane-java`) |
| Ruby | GitHub Packages RubyGems (`owlpane`) |

Customer install: `npm install @owlpane/node` — no GitHub token. See [docs/ops/sdk-install.md](docs/ops/sdk-install.md).

Secrets: **`NPM_TOKEN`** (npm automation token for `@owlpane` scope), **`GH_PACKAGES_TOKEN`** (Java/Ruby on GitHub Packages), optional **`PYPI_API_TOKEN`**.

See `.github/workflows/publish-sdk.yml`.

Split from the [Owlpane monorepo](https://github.com/balaji-singh/owlpane).
