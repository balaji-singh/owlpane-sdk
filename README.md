# Owlpane SDK

Customer-facing packages:

- `@owlpane/node` — `packages/node` (full)
- `@owlpane/browser` — `packages/browser` (full)
- `github.com/balaji-singh/owlpane-sdk/packages/go` — `packages/go` (thin, generated env + hand OTel)
- `owlpane` (PyPI-style) — `packages/python` (thin)
- Java / Ruby / .NET — **planned** thin starters (see multi-language architecture)

**Multi-language design:** [docs/MULTILANGUAGE-SDK-ARCHITECTURE.md](docs/MULTILANGUAGE-SDK-ARCHITECTURE.md)  
**Contract (codegen source of truth):** [schema/sdk-contract.schema.json](schema/sdk-contract.schema.json)

**Release (`sdk-v*` tag):** one workflow publishes **all** languages:

| Language | Registry |
|----------|----------|
| Node, Browser | GitHub Packages npm (`@balaji-singh/owlpane-*`) |
| Python | PyPI (`owlpane`) if `PYPI_API_TOKEN` + wheel on GitHub Release |
| Go | Git tag `packages/go/v*` |
| Java | GitHub Packages Maven (`com.owlpane:owlpane-java`) |
| Ruby | GitHub Packages RubyGems (`owlpane`) |

Secrets: **`GH_PACKAGES_TOKEN`** (classic PAT: `write:packages` + `repo`), optional **`PYPI_API_TOKEN`**. See [docs/github-packages-npmrc.example](docs/github-packages-npmrc.example).

Source in the monorepo stays `@owlpane/node` / `@owlpane/browser`; the registry scope must match the GitHub owner (`@balaji-singh/…`). Java / Ruby / .NET are not on a registry yet.

See `.github/workflows/publish-sdk.yml`.

Split from the [Owlpane monorepo](https://github.com/balaji-singh/owlpane).
