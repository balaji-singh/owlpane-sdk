import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { otlpUrls, resolveInitOptions } from "../lib/resolve-config.js";

describe("resolveInitOptions", () => {
  it("returns null when endpoint missing", () => {
    assert.equal(resolveInitOptions({}), null);
  });

  it("returns null when OTEL_SDK_DISABLED", () => {
    assert.equal(
      resolveInitOptions(
        { OTEL_SDK_DISABLED: "true", OTEL_EXPORTER_OTLP_ENDPOINT: "http://x" },
      ),
      null,
    );
  });

  it("resolves from env with bearer header", () => {
    const r = resolveInitOptions({
      OTEL_EXPORTER_OTLP_ENDPOINT: "https://ingest.example.com/",
      OWLPANE_INGEST_KEY: "owl_ing_" + "a".repeat(48),
      OTEL_SERVICE_NAME: "api",
      OWLPANE_ENVIRONMENT: "staging",
      OWLPANE_RELEASE: "1.2.3",
    });
    assert.ok(r);
    assert.equal(r!.baseUrl, "https://ingest.example.com");
    assert.equal(r!.headers.Authorization, `Bearer owl_ing_${"a".repeat(48)}`);
    assert.equal(r!.serviceName, "api");
    assert.equal(r!.environment, "staging");
    assert.equal(r!.version, "1.2.3");
  });

  it("options override env", () => {
    const r = resolveInitOptions(
      { OTEL_EXPORTER_OTLP_ENDPOINT: "http://env", OTEL_SERVICE_NAME: "env-svc" },
      { service: "opt-svc", endpoint: "http://opt" },
    );
    assert.equal(r!.serviceName, "opt-svc");
    assert.equal(r!.baseUrl, "http://opt");
  });

  it("sample ratio defaults production to 0.1", () => {
    const r = resolveInitOptions({
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://x",
      NODE_ENV: "production",
    });
    assert.equal(r!.sampleRatio, 0.1);
  });

  it("otlpUrls appends paths", () => {
    assert.deepEqual(otlpUrls("http://h"), {
      traces: "http://h/v1/traces",
      logs: "http://h/v1/logs",
      metrics: "http://h/v1/metrics",
    });
  });
});
