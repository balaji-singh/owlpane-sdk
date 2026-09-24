import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schema = JSON.parse(
  fs.readFileSync(path.join(root, "schema", "sdk-contract.schema.json"), "utf8"),
);
const ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false });
const validate = ajv.compile(schema);
const fixture = {
  version: "1",
  otlp: {
    paths: { traces: "/v1/traces", logs: "/v1/logs", metrics: "/v1/metrics" },
    authHeader: "Authorization",
    authScheme: "Bearer",
    ingestKeyPattern: "^owl_ing_[0-9a-f]{48}$",
  },
  initOptions: {},
  env: {
    endpoint: ["OTEL_EXPORTER_OTLP_ENDPOINT", "OWLPANE_INGEST_URL"],
    ingestKey: "OWLPANE_INGEST_KEY",
    serviceName: "OTEL_SERVICE_NAME",
    environment: "OWLPANE_ENVIRONMENT",
    release: "OWLPANE_RELEASE",
    disabled: "OTEL_SDK_DISABLED",
    traceUserProfile: "OWLPANE_TRACE_USER_PROFILE",
    metricsExportIntervalMs: "OWLPANE_METRICS_EXPORT_INTERVAL_MS",
  },
  portableApi: { start: {}, shutdown: {}, job: {}, setUser: {}, isEnabled: {} },
  packageTiers: { full: ["node", "browser"], thin: ["go", "java", "python", "ruby", "dotnet"] },
};
if (!validate(fixture)) {
  console.error(validate.errors);
  process.exit(1);
}
console.log("schema: ok");
