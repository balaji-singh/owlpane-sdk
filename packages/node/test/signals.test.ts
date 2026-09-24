import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { trace, context } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import {
  experimentAttributes,
  featureFlagAttributes,
  findingAttributes,
  mobileResource,
  pipeline,
  pipelineAttributes,
  recordFinding,
  serviceCatalogAttributes,
  setExperiment,
  testCase,
  testCaseAttributes,
} from "../src/signals.js";

describe("console signal attributes", () => {
  it("names a mobile resource with the OpenTelemetry os.name the Mobile page matches", () => {
    assert.deepEqual(mobileResource("ios", { reactNative: true }), {
      "os.type": "darwin",
      "os.name": "iOS",
      "telemetry.sdk.language": "react-native",
      "process.runtime.name": "react-native",
    });
    assert.equal(mobileResource("android")["os.name"], "Android");
    assert.equal(mobileResource("android")["os.type"], "linux");
    assert.equal(mobileResource("android")["telemetry.sdk.language"], undefined);
  });

  it("builds experiment, flag, test, pipeline, finding, and catalog attributes", () => {
    assert.deepEqual(experimentAttributes("checkout", "b"), {
      "owlpane.experiment.id": "checkout",
      "owlpane.experiment.variant": "b",
    });
    assert.equal(experimentAttributes("  "), undefined);
    assert.deepEqual(featureFlagAttributes("new-nav", "on"), {
      "feature_flag.key": "new-nav",
      "feature_flag.result.variant": "on",
    });
    assert.equal(featureFlagAttributes(""), undefined);
    const testAttrs = testCaseAttributes("login", "pass", "auth");
    assert.equal(testAttrs?.["test.case.name"], "login");
    assert.equal(testAttrs?.["test.name"], "login");
    assert.equal(testAttrs?.["test.case.result.status"], "pass");
    assert.equal(testAttrs?.["test.suite.name"], "auth");
    assert.equal(pipelineAttributes("release", "failure", "82")?.["cicd.pipeline.result"], "failure");
    assert.equal(pipelineAttributes("release", "success", "82")?.["cicd.coverage"], "82");
    assert.equal(findingAttributes({ kind: "vulnerability", id: "CVE-1", title: "openssl" })?.["owlpane.finding.kind"], "vulnerability");
    assert.equal(findingAttributes({ kind: "vulnerability", id: "", title: "x" }), undefined);
    assert.deepEqual(serviceCatalogAttributes("payments", "https://github.com/acme/pay"), {
      "service.owner": "payments",
      "vcs.repository.url.full": "https://github.com/acme/pay",
    });
  });

  it("stamps the active span and records a passing test span", async () => {
    const exporter = new InMemorySpanExporter();
    const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
    const manager = new AsyncLocalStorageContextManager();
    manager.enable();
    const previous = trace.getTracerProvider();
    context.disable();
    context.setGlobalContextManager(manager);
    trace.setGlobalTracerProvider(provider);
    try {
      assert.equal(setExperiment("checkout"), false);
      await provider.getTracer("t").startActiveSpan("request", async (span) => {
        assert.equal(setExperiment("checkout", "b"), true);
        span.end();
      });
      await testCase("login", async () => "ok", { suite: "auth" });
      await assert.rejects(pipeline("release", async () => { throw new Error("boom"); }), /boom/);
      const spans = exporter.getFinishedSpans();
      const request = spans.find((s) => s.name === "request");
      assert.equal(request?.attributes["owlpane.experiment.id"], "checkout");
      const login = spans.find((s) => s.name === "login");
      assert.equal(login?.attributes["test.case.name"], "login");
      assert.equal(login?.attributes["test.case.result.status"], "pass");
      const release = spans.find((s) => s.name === "release");
      assert.equal(release?.attributes["cicd.pipeline.name"], "release");
      assert.equal(release?.attributes["cicd.pipeline.result"], "failure");
    } finally {
      context.disable();
      trace.setGlobalTracerProvider(previous);
    }
  });

  it("refuses a finding with no id and accepts a complete one", () => {
    assert.equal(recordFinding({ kind: "vulnerability", id: "", title: "x" }), false);
    assert.equal(recordFinding({ kind: "secret", id: "s1", title: "token in log", source: "trivy" }), true);
  });
});
