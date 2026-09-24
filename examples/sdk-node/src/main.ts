import { job, owlpane, shutdown, isEnabled } from "@owlpane/node";

owlpane.start({
  service: process.env.OTEL_SERVICE_NAME,
  endpoint: process.env.OWLPANE_INGEST_URL ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  ingestKey: process.env.OWLPANE_INGEST_KEY,
  environment: process.env.OWLPANE_ENVIRONMENT,
  release: "sdk-node-example-0.1.1",
});

if (!isEnabled()) {
  console.error("owlpane did not start — check examples/.env");
  process.exit(1);
}

await job("hello-owlpane", "task", { "example.lang": "node" }, async () => {
  await new Promise((r) => setTimeout(r, 50));
});

await shutdown();
console.log("span emitted (check Owlpane console)");
