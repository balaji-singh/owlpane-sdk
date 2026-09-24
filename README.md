# Owlpane SDK

Customer-facing packages:

- `@owlpane/node` — `packages/node` (full)
- `@owlpane/browser` — `packages/browser` (full)
- `github.com/balaji-singh/owlpane-sdk/packages/go` — `packages/go` (thin, generated env + hand OTel)
- `owlpane` (PyPI-style) — `packages/python` (thin)
- Java / Ruby / .NET — **planned** thin starters (see multi-language architecture)

**Multi-language design:** [docs/MULTILANGUAGE-SDK-ARCHITECTURE.md](docs/MULTILANGUAGE-SDK-ARCHITECTURE.md)  
**Contract (codegen source of truth):** [schema/sdk-contract.schema.json](schema/sdk-contract.schema.json)

**Release (`sdk-v*` tag):** publishes **GitHub Packages** (npm: `@balaji-singh/owlpane-node`, `@balaji-singh/owlpane-browser`), tags **Go** (`packages/go/v*`), and optionally **PyPI** (`owlpane` if `PYPI_API_TOKEN` is set). No npmjs.com — packages show under this repo’s **Packages** tab. See [docs/github-packages-npmrc.example](docs/github-packages-npmrc.example).

Source in the monorepo stays `@owlpane/node` / `@owlpane/browser`; the registry scope must match the GitHub owner (`@balaji-singh/…`). Java / Ruby / .NET are not on a registry yet.

See `.github/workflows/publish-sdk.yml`.

Split from the [Owlpane monorepo](https://github.com/balaji-singh/owlpane).
