# @owlpane/node

One-line OpenTelemetry setup for Node.js that sends traces and metrics to Owlpane, plus job tracing and
per-user tagging. Optional NestJS helpers live at `@owlpane/node/nest`.

```ts
// Run before anything else is imported (for example the first line of main.ts).
import { owlpane } from "@owlpane/node";

owlpane.start({
  service: "checkout-api",
  endpoint: "https://ingest.example.com", // your Owlpane ingest gateway
  ingestKey: process.env.OWLPANE_INGEST_KEY, // owl_ing_..., one per project
  release: process.env.GIT_SHA, // shows on the Releases page
});
```

Everything can also come from environment variables: `OTEL_EXPORTER_OTLP_ENDPOINT`, `OWLPANE_INGEST_KEY`,
`OTEL_SERVICE_NAME`, `OWLPANE_RELEASE`, `OWLPANE_ENVIRONMENT`. Set `OTEL_SDK_DISABLED=true` to switch it off.

- **Never blocks your app.** Export is batched and fails quietly; the SDK does nothing when no endpoint is set.
- **Your key is a write-only credential.** It can send data for one project and cannot read anything.
- **Privacy.** Query strings, cookies and authorization headers are removed at the gateway as well as here.

Track a background job: `await owlpane.job("nightly-report", "cron", {}, async () => { ... })`.
Tag the signed-in user (opaque id only): `owlpane.setUser(user.id)`. Email and name are **not** recorded unless you opt in with `traceUserProfile: true` or `OWLPANE_TRACE_USER_PROFILE=1` (discouraged for production).

These helpers set the attributes the console pages filter on. They do nothing useful until `start()` has an endpoint, except `mobileResource`, which only returns attributes for you to pass in:

| Helper | Attribute | Console page |
| --- | --- | --- |
| `owlpane.setExperiment(id, variant?)` | `owlpane.experiment.id` | Experiments |
| `owlpane.setFeatureFlag(key, variant?)` | `feature_flag.key` | Feature flags |
| `owlpane.testCase(name, fn)` | `test.case.name` and `test.name` | Tests |
| `owlpane.pipeline(name, fn)` | `cicd.pipeline.name` | CI / DORA |
| `owlpane.recordFinding({ kind, id, title })` | `owlpane.finding.kind` | Security findings |
| `owlpane.mobileResource("ios" \| "android" \| "ipados", { reactNative: true })` | `os.name`, and `telemetry.sdk.language=react-native` when asked | Mobile, React Native |
| `start({ owner, repository })` | `service.owner`, `vcs.repository.url.full` | Service catalog |

`os.type` follows the OpenTelemetry enum (`darwin` for iOS and iPadOS, `linux` for Android). The Mobile page matches `os.name` (`iOS`, `Android`, `iPadOS`), not a desktop Node process.

**LLM usage in Owlpane:** when your app calls the official [`openai`](https://www.npmjs.com/package/openai) client (including Groq via `baseURL: "https://api.groq.com/openai/v1"`), `@opentelemetry/instrumentation-openai` is registered automatically and emits `gen_ai.*` span attributes for the LLM usage page. Disable with `disableInstrumentations: ["@opentelemetry/instrumentation-openai"]`. Raw `fetch` to an LLM API is not instrumented.

Full documentation: the `docs/05-onboarding-applications.md` guide in the Owlpane repository.
