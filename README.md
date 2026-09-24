# Owlpane SDK

Customer-facing packages:

- `@owlpane/node` — `packages/node` (full)
- `@owlpane/browser` — `packages/browser` (full)
- `github.com/owlpane/owlpane-go` — `packages/go` (thin, generated env + hand OTel)
- `owlpane` (PyPI-style) — `packages/python` (thin)
- Java / Ruby / .NET — **planned** thin starters (see multi-language architecture)

**Multi-language design:** [docs/MULTILANGUAGE-SDK-ARCHITECTURE.md](docs/MULTILANGUAGE-SDK-ARCHITECTURE.md)  
**Contract (codegen source of truth):** [schema/sdk-contract.schema.json](schema/sdk-contract.schema.json)

**Release (`sdk-v*` tag):** publishes **npm** (`@owlpane/node`, `@owlpane/browser`), **PyPI** (`owlpane`), and tags **Go** (`packages/go/v*`). Needs repo secrets `NPM_TOKEN` and `PYPI_API_TOKEN`. Java / Ruby / .NET thin gems are **not** on registries yet — use env from `schema/install-snippets.json` with the OTel agent for those stacks.

See `.github/workflows/publish-sdk.yml`.

Split from the [Owlpane monorepo](https://github.com/balaji-singh/owlpane).
