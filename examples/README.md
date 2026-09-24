# SDK dogfood examples

Minimal **one-shot apps** that install the **published** Owlpane SDK (or plain OpenTelemetry where the thin SDK is env-only) and send a single **Server** span to your ingest gateway. Use them to dogfood the SaaS the same way customers onboard.

## Standard onboarding (one project per app)

In the console, create **five projects** (names must match `dogfood.manifest.json`):

| Console project | Example app | Package / path |
|-----------------|-------------|----------------|
| `owlpane-sdk-node` | [`apps/node`](apps/node) | `@balaji-singh/owlpane-node@0.1.2` (GitHub Packages npm) |
| `owlpane-sdk-go` | [`apps/go`](apps/go) | `github.com/balaji-singh/owlpane-sdk/packages/go@v0.1.1` |
| `owlpane-sdk-python` | [`apps/python`](apps/python) | `owlpane==0.1.2` (PyPI) |
| `owlpane-sdk-java` | [`apps/java`](apps/java) | OpenTelemetry **javaagent** + `OTEL_*` env |
| `owlpane-sdk-ruby` | [`apps/ruby`](apps/ruby) | `opentelemetry-sdk` + OTLP exporter |

Each project gets its **own ingest key**. `OTEL_SERVICE_NAME` is set to the project slug (same rule as **InstallGuide** in the console).

```bash
chmod +x run-dogfood.sh scripts/onboard-dogfood.sh apps/*/run.sh
# Creates five console projects + keys (Scale org by default), writes examples/.env:
./scripts/onboard-dogfood.sh --write-env
./run-dogfood.sh
```

Uses the same API as **+ New project** (`POST /v1/orgs/:id/projects`). Override with `OWLPANE_ONBOARD_EMAIL`, `OWLPANE_ONBOARD_PASSWORD`, `OWLPANE_ORG_SLUG` (default `scale@owlpane.test` / `owlpane` / `scale`).

**Auth for Node:** `gh auth refresh -h github.com -s read:packages` (or set `GITHUB_PACKAGES_TOKEN`).

**Console:** Applications → Python / Java / Node.js, deploy env **development**, last hour — or **Traces** with `service.name` `owlpane-sdk-*`.

For a quick smoke test only, you may set a single `OWLPANE_INGEST_KEY` (all apps share one project); the runner prints a warning.

## Other samples

| Path | Purpose |
|------|---------|
| [`conformance/`](conformance/) | Plain OTel samples + `_receiver` for CI/docs (no real ingest) |
| [`pii-canary/`](pii-canary/) | PII scrub verification against a live ingest |
| [`_receiver/`](_receiver/) | Throwaway OTLP receiver used by package conformance tests |

## Monorepo developers

Examples always use **remote** artifacts (`OWLPANE_SDK_SOURCE=published`). To test unreleased SDK changes, work in `packages/*` conformance scripts (`npm test`) or temporarily point an app at a local path in a branch — do not commit local `file:` / `replace` overrides here.
