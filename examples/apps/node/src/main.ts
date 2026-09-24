import { trace, SpanKind } from "@opentelemetry/api";
import { owlpane, shutdown, isEnabled } from "@owlpane/node";

owlpane.start({
  service: process.env.OTEL_SERVICE_NAME,
  endpoint: process.env.OWLPANE_INGEST_URL ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  ingestKey: process.env.OWLPANE_INGEST_KEY,
  environment: process.env.OWLPANE_ENVIRONMENT,
  release: "0.1.1",
});

if (!isEnabled()) {
  console.error("owlpane did not start — check examples/.env");
  process.exit(1);
}

await trace.getTracer("owlpane-dogfood").startActiveSpan(
  "GET /demo",
  { kind: SpanKind.SERVER },
  async (span) => {
    await new Promise((r) => setTimeout(r, 50));
    span.end();
  },
);

await shutdown();
console.log(`span emitted (${process.env.OTEL_SERVICE_NAME})`);
