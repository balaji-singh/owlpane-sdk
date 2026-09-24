# @owlpane/browser

Zero-dependency real-user-monitoring SDK for browsers. Sends OTLP/HTTP JSON traces to the Owlpane ingest gateway.

## Install and use

```ts
import { init } from "@owlpane/browser";

init({
  endpoint: "https://ingest.example.com",     // `/v1/traces` is appended
  projectKey: "owl_ing_...",                   // sent as `Authorization: Bearer <key>`
  serviceName: "web-shop",
  environment: "production",
  release: "1.4.2",
  sampleRate: 1,                               // 0..1, decided per trace
  propagateTraceTo: ["https://api.example.com", /^https:\/\/[a-z]+\.internal\.io\//],
});
```

Script tag: `npm run build:iife -w @owlpane/browser` produces `dist/owlpane-browser.iife.js` (global `OwlpaneBrowser`). It uses `esbuild`, which is not a dependency of this package; it must be present in the workspace `node_modules`.

`init()` never throws, is a no-op if called twice, and returns `{ sessionId, flush(), shutdown(), captureException(err), setExperiment(id), setFeatureFlag(key) }`.

`setExperiment("checkout", "b")` stamps `owlpane.experiment.id` on spans that end afterwards (Experiments). `setFeatureFlag("new-nav", "on")` stamps `feature_flag.key` (Feature flags). A browser page is not a mobile app: this SDK does not set `os.name` to iOS or Android.

## What it captures

| Signal | Span name | Notes |
| --- | --- | --- |
| Page load | `documentLoad` | Root span of the page-view trace, navigation start to `loadEventEnd`. Phase timings are attributes, not child spans. |
| Web Vitals | `webvital.LCP`, `webvital.CLS`, `webvital.INP` | Spans (not metrics) so they need no extra ingest path and share the page trace. Reported once, when the page becomes hidden. Child of `documentLoad`. |
| JS errors | `exception` | `error` and `unhandledrejection`, with an `exception` span event (`exception.type`, `exception.message`, `exception.stacktrace`). Capped at 20 per page view. |
| fetch / XHR | `HTTP <METHOD>` | Client spans, each its own trace. |

### Attributes

Resource: `service.name`, `service.version`, `deployment.environment.name`, `deployment.environment`, `telemetry.sdk.name=owlpane-browser`, `telemetry.sdk.language=webjs`, `telemetry.sdk.version`, `owlpane.rum=true`.

Every span: `owlpane.rum="true"`, `session.id`, `browser.page.url` (origin + path), `browser.page.path`, `user_agent.original`, `browser.language`, `browser.platform`, `browser.mobile`.

- `documentLoad`: `browser.navigation.type`, `browser.timing.{redirect,dns,connect,ttfb,response,dom_interactive,dom_content_loaded,load}_ms`, `browser.timing.transfer_size_bytes`.
- `webvital.*`: `webvital.name`, `webvital.value`, `webvital.unit` (`ms` or `score`), `webvital.rating` (`good|needs-improvement|poor`), INP also `webvital.interactions`.
- `exception`: `owlpane.error.source` (`onerror|unhandledrejection|manual`), `code.filepath`, `code.lineno`, `code.column`; span status ERROR.
- HTTP: `http.request.method`, `url.full`, `server.address`, `http.response.status_code`, `error.type`; status ERROR for >= 400 or network failure.

## Trace propagation

A W3C `traceparent` header is added to requests to the page's own origin, and to any URL matching `propagateTraceTo` (string = URL prefix, RegExp = tested against the absolute URL). An existing `traceparent` is left alone. Cross-origin targets must allow the header in their CORS config (`Access-Control-Allow-Headers: traceparent`), otherwise the browser will fail the preflight and the request itself breaks. Only list origins you control.

## Privacy

Query strings, hashes and URL credentials are stripped from recorded URLs. `keepQuery: true` keeps the query (still never the hash). Request/response bodies and headers are never recorded. Page paths are recorded as-is, so avoid putting identifiers in paths you do not want stored.

## Delivery and limits

- Batched every 5s or 100 spans, bodies capped at 60,000 bytes (browsers limit `keepalive` bodies to 64 KiB), queue capped at 500 spans (oldest dropped).
- Uses `fetch` with `keepalive: true` and flushes on `pagehide` and when the page becomes hidden. `navigator.sendBeacon` is deliberately not used: it cannot set an `Authorization` header.
- Failures are dropped silently, no retry. Telemetry is best-effort.
- The export request is never instrumented (the original `fetch` is captured before patching and the ingest endpoint is skipped).
- The project key is visible to anyone who loads your page. Use a dedicated, revocable key for the browser.
- The ingest gateway must answer CORS preflight for the browser to deliver anything (see the gateway notes from the platform team).
- INP uses the `event` timing observer, LCP/CLS the standard entry types; unsupported browsers (e.g. Safari for INP/LCP in some versions) simply report fewer vitals. Values are approximations of the `web-vitals` library, not bit-identical. Vitals are reported once per page view (no SPA soft-navigation vitals).
- XHR instrumentation patches `XMLHttpRequest.prototype`; it does not capture `sendBeacon`, WebSocket or resource-loading errors.
- SPA route changes are not tracked as separate page views; `browser.page.path` reflects the path at span end.

## Tests

`npm test -w @owlpane/browser` (node:test + tsx, no DOM library; browser globals are injected fakes).
