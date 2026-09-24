/**
 * Attribute builders for the console pages that filter on a specific OpenTelemetry field.
 * The names match the catalog queries in the API. Builders never invent a value the caller did not pass.
 */
import { trace, SpanStatusCode, type Attributes, type Span } from "@opentelemetry/api";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";

/** OpenTelemetry semantic convention names. Inlined because this package's tsconfig resolves modules as "node", which cannot load the incubating export. */
const ATTR_FEATURE_FLAG_KEY = "feature_flag.key";
const ATTR_FEATURE_FLAG_RESULT_VARIANT = "feature_flag.result.variant";
const ATTR_OS_NAME = "os.name";
const ATTR_OS_TYPE = "os.type";
const ATTR_TEST_CASE_NAME = "test.case.name";
const ATTR_TEST_CASE_RESULT_STATUS = "test.case.result.status";
const ATTR_TEST_SUITE_NAME = "test.suite.name";
const ATTR_CICD_PIPELINE_NAME = "cicd.pipeline.name";
const ATTR_CICD_PIPELINE_RESULT = "cicd.pipeline.result";
const ATTR_VCS_REPOSITORY_URL_FULL = "vcs.repository.url.full";
const CICD_PIPELINE_RESULT_VALUE_FAILURE = "failure";
const CICD_PIPELINE_RESULT_VALUE_SUCCESS = "success";
const OS_TYPE_VALUE_DARWIN = "darwin";
const OS_TYPE_VALUE_LINUX = "linux";
const TEST_CASE_RESULT_STATUS_VALUE_FAIL = "fail";
const TEST_CASE_RESULT_STATUS_VALUE_PASS = "pass";

export const EXPERIMENT_ID = "owlpane.experiment.id";
export const EXPERIMENT_VARIANT = "owlpane.experiment.variant";
/** The Feature flags page filters on this. OpenTelemetry has no experiment signal. */
export const FEATURE_FLAG_KEY = ATTR_FEATURE_FLAG_KEY;

export const FINDING_KINDS = [
  "code",
  "dependency",
  "static",
  "runtime",
  "manifest",
  "secret",
  "posture",
  "identity",
  "vulnerability",
  "compliance",
  "workload",
] as const;
export type FindingKind = (typeof FINDING_KINDS)[number];

export type MobilePlatform = "ios" | "android" | "ipados";

const OS_NAME: Record<MobilePlatform, string> = {
  ios: "iOS",
  android: "Android",
  ipados: "iPadOS",
};

/** Resource attributes for a mobile process. `os.name` is the signal the Mobile page matches. */
export function mobileResource(
  platform: MobilePlatform,
  opts?: { reactNative?: boolean },
): Record<string, string> {
  const attrs: Record<string, string> = {
    [ATTR_OS_TYPE]: platform === "android" ? OS_TYPE_VALUE_LINUX : OS_TYPE_VALUE_DARWIN,
    [ATTR_OS_NAME]: OS_NAME[platform],
  };
  if (opts?.reactNative) {
    attrs["telemetry.sdk.language"] = "react-native";
    attrs["process.runtime.name"] = "react-native";
  }
  return attrs;
}

export function serviceCatalogAttributes(owner?: string, repository?: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const o = owner?.trim();
  const repo = repository?.trim();
  if (o) attrs["service.owner"] = o;
  if (repo) attrs[ATTR_VCS_REPOSITORY_URL_FULL] = repo;
  return attrs;
}

export function experimentAttributes(id: string, variant?: string): Attributes | undefined {
  const key = id.trim();
  if (!key) return undefined;
  const attrs: Attributes = { [EXPERIMENT_ID]: key };
  const v = variant?.trim();
  if (v) attrs[EXPERIMENT_VARIANT] = v;
  return attrs;
}

export function featureFlagAttributes(key: string, variant?: string): Attributes | undefined {
  const name = key.trim();
  if (!name) return undefined;
  const attrs: Attributes = { [ATTR_FEATURE_FLAG_KEY]: name };
  const v = variant?.trim();
  if (v) attrs[ATTR_FEATURE_FLAG_RESULT_VARIANT] = v;
  return attrs;
}

export function testCaseAttributes(
  name: string,
  status: "pass" | "fail",
  suite?: string,
): Attributes | undefined {
  const testName = name.trim();
  if (!testName) return undefined;
  const attrs: Attributes = {
    [ATTR_TEST_CASE_NAME]: testName,
    "test.name": testName,
    [ATTR_TEST_CASE_RESULT_STATUS]:
      status === "pass" ? TEST_CASE_RESULT_STATUS_VALUE_PASS : TEST_CASE_RESULT_STATUS_VALUE_FAIL,
  };
  const suiteName = suite?.trim();
  if (suiteName) attrs[ATTR_TEST_SUITE_NAME] = suiteName;
  return attrs;
}

export function pipelineAttributes(
  name: string,
  result: "success" | "failure",
  coverage?: string,
): Attributes | undefined {
  const pipeline = name.trim();
  if (!pipeline) return undefined;
  const attrs: Attributes = {
    [ATTR_CICD_PIPELINE_NAME]: pipeline,
    [ATTR_CICD_PIPELINE_RESULT]:
      result === "success" ? CICD_PIPELINE_RESULT_VALUE_SUCCESS : CICD_PIPELINE_RESULT_VALUE_FAILURE,
  };
  const cov = coverage?.trim();
  if (cov) attrs["cicd.coverage"] = cov;
  return attrs;
}

export function findingAttributes(input: {
  kind: FindingKind;
  id: string;
  title: string;
  severity?: string;
  source?: string;
}): Attributes | undefined {
  if (!FINDING_KINDS.includes(input.kind)) return undefined;
  const id = input.id.trim();
  const title = input.title.trim();
  if (!id || !title) return undefined;
  const attrs: Attributes = {
    "owlpane.finding.kind": input.kind,
    "owlpane.finding.id": id,
    "owlpane.finding.title": title,
  };
  const severity = input.severity?.trim();
  const source = input.source?.trim();
  if (severity) attrs["owlpane.finding.severity"] = severity;
  if (source) attrs["owlpane.finding.source"] = source;
  return attrs;
}

function stamp(attrs: Attributes | undefined): boolean {
  if (!attrs) return false;
  const span = trace.getActiveSpan();
  if (!span) return false;
  span.setAttributes(attrs);
  return true;
}

/** Stamps `owlpane.experiment.id` on the active span. Experiments are an app attribute, not an OpenTelemetry signal. */
export function setExperiment(id: string, variant?: string): boolean {
  return stamp(experimentAttributes(id, variant));
}

/** Stamps `feature_flag.key` (and `feature_flag.result.variant` when given) on the active span. */
export function setFeatureFlag(key: string, variant?: string): boolean {
  return stamp(featureFlagAttributes(key, variant));
}

/** Root span named after the test case, with `test.case.name` and `test.name`. */
export async function testCase<T>(
  name: string,
  fn: () => Promise<T>,
  opts?: { suite?: string },
): Promise<T> {
  const testName = name.trim();
  if (!testName) return fn();
  const tracer = trace.getTracer("owlpane-tests");
  return tracer.startActiveSpan(testName, { root: true }, async (span) => {
    try {
      const value = await fn();
      const attrs = testCaseAttributes(name, "pass", opts?.suite);
      if (attrs) span.setAttributes(attrs);
      return value;
    } catch (err) {
      const attrs = testCaseAttributes(name, "fail", opts?.suite);
      if (attrs) span.setAttributes(attrs);
      const e = err instanceof Error ? err : new Error(String(err));
      span.recordException(e);
      span.setStatus({ code: SpanStatusCode.ERROR, message: e.message });
      throw err;
    } finally {
      span.end();
    }
  });
}

/** Root span with `cicd.pipeline.name` and `cicd.pipeline.result`. */
export async function pipeline<T>(
  name: string,
  fn: () => Promise<T>,
  opts?: { coverage?: string },
): Promise<T> {
  const pipelineName = name.trim();
  if (!pipelineName) return fn();
  const tracer = trace.getTracer("owlpane-cicd");
  return tracer.startActiveSpan(pipelineName, { root: true }, async (span: Span) => {
    let result: "success" | "failure" = "success";
    try {
      return await fn();
    } catch (err) {
      result = "failure";
      const e = err instanceof Error ? err : new Error(String(err));
      span.recordException(e);
      span.setStatus({ code: SpanStatusCode.ERROR, message: e.message });
      throw err;
    } finally {
      const attrs = pipelineAttributes(name, result, opts?.coverage);
      if (attrs) span.setAttributes(attrs);
      span.end();
    }
  });
}

/**
 * Log record the security catalog pages filter on (`owlpane.finding.kind`).
 * No-op until `start()` has installed the log provider, and no-op for an unknown kind.
 */
export function recordFinding(input: {
  kind: FindingKind;
  id: string;
  title: string;
  severity?: string;
  source?: string;
}): boolean {
  const attributes = findingAttributes(input);
  if (!attributes) return false;
  logs.getLogger("owlpane-findings").emit({
    body: input.title.trim(),
    severityNumber: SeverityNumber.WARN,
    attributes,
  });
  return true;
}
