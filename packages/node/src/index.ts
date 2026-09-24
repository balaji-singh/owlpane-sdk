/**
 * @owlpane/node — one-line OpenTelemetry setup for any Node.js service.
 *
 * import { owlpane } from "@owlpane/node";
 * owlpane.start({ service: "my-api" });   // call before any other app code is imported
 *
 * Activation: set OWLPANE_INGEST_URL (or the standard OTEL_EXPORTER_OTLP_ENDPOINT) to turn on.
 * Without it, start() is a no-op — zero overhead when there is nowhere to send data.
 *
 * What you get: HTTP/Express/pg/ioredis/… auto-instrumentation, a `job()` wrapper for background
 * work (cron, queue, one-off), `setUser()` to tag the current trace with a signed-in user, and
 * process CPU/memory metrics. Framework-specific helpers (NestJS job discovery, a request
 * interceptor) are at "@owlpane/node/nest" so this entry point has no framework dependency.
 */
import { NodeSDK, tracing, resources, api, metrics } from "@opentelemetry/sdk-node";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OpenAIInstrumentation } from "@opentelemetry/instrumentation-openai";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { logs as logsApi } from "@opentelemetry/api-logs";
import { LoggerProvider, BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";

const { BatchSpanProcessor, ParentBasedSampler, TraceIdRatioBasedSampler } =
  tracing;
const { resourceFromAttributes } = resources;

export type InitOptions = {
  /** Shows up as `service.name`. Falls back to OTEL_SERVICE_NAME, then "node-app". */
  service?: string;
  /** OTLP/HTTP endpoint (an Owlpane ingest gateway, or any OTel collector). Falls back to OTEL_EXPORTER_OTLP_ENDPOINT. */
  endpoint?: string;
  /** Sent as `Authorization: Bearer <key>` to the ingest gateway. */
  ingestKey?: string;
  /** `deployment.environment.name`. Falls back to OTEL_RESOURCE_ATTRIBUTES / NODE_ENV. */
  environment?: string;
  /** `service.version` — the release/deploy identifier shown on the Releases page. */
  release?: string;
  /** Trace sample ratio 0–1. */
  sampleRatio?: number;
  /** Extra resource attributes merged in alongside service/version/environment. */
  resourceAttributes?: Record<string, string>;
  /** Auto-instrumentation names to turn off, e.g. ["@opentelemetry/instrumentation-fs"]. */
  disableInstrumentations?: string[];
  /** When true, setUser may record enduser.email / enduser.name (off by default). */
  traceUserProfile?: boolean;
};

let sdk: NodeSDK | undefined;
let logProvider: LoggerProvider | undefined;
let traceUserProfile = false;

/** Whether setUser may attach email/name (requires start({ traceUserProfile: true }) or OWLPANE_TRACE_USER_PROFILE=1). */
export function traceUserProfileEnabled(): boolean {
  return traceUserProfile;
}

function endpointOf(o: InitOptions): string | undefined {
  return (
    o.endpoint?.trim() || process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim() || undefined
  );
}

/** True once `start()` has turned tracing on (an endpoint was configured and it isn't disabled). */
export function isEnabled(): boolean {
  return sdk !== undefined;
}

function sampleRatio(o: InitOptions): number {
  if (o.sampleRatio !== undefined) return o.sampleRatio;
  const raw = process.env.OTEL_TRACES_SAMPLER_ARG;
  if (!raw) return process.env.NODE_ENV === "production" ? 0.1 : 1;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : 0.1;
}

/**
 * Starts the telemetry pipeline. Call once, as the very first thing the process does — before any
 * other import — so every module picks up the instrumented http/pg/etc. Safe to call when
 * unconfigured: it just does nothing.
 */
export function start(options: InitOptions = {}): void {
  if (process.env.OTEL_SDK_DISABLED === "true") return;
  traceUserProfile =
    options.traceUserProfile === true ||
    ["1", "true", "yes"].includes((process.env.OWLPANE_TRACE_USER_PROFILE ?? "").trim().toLowerCase());
  const endpoint = endpointOf(options);
  if (!endpoint) return;
  if (sdk) return; // already started

  const serviceName =
    options.service?.trim() ||
    process.env.OTEL_SERVICE_NAME?.trim() ||
    "node-app";
  const version =
    options.release?.trim() ||
    process.env.OWLPANE_RELEASE?.trim() ||
    "0.0.0";
  const environment =
    options.environment?.trim() ||
    process.env.OWLPANE_ENVIRONMENT?.trim() ||
    process.env.NODE_ENV?.trim() ||
    "development";
  const ingestKey = options.ingestKey?.trim() || process.env.OWLPANE_INGEST_KEY?.trim();

  const headers = ingestKey ? { Authorization: `Bearer ${ingestKey}` } : undefined;
  const baseUrl = endpoint.replace(/\/+$/, "");
  const exportProcessor = new BatchSpanProcessor(
    new OTLPTraceExporter({ url: `${baseUrl}/v1/traces`, headers }),
  );

  const ratio = sampleRatio(options);
  const disabled = new Set(options.disableInstrumentations ?? []);
  const off = (name: string) => ({ enabled: !disabled.has(name) });

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: version,
    "deployment.environment.name": environment,
    ...options.resourceAttributes,
  });

  logProvider = new LoggerProvider({
    resource,
    processors: [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({ url: `${baseUrl}/v1/logs`, headers }),
      }),
    ],
  });
  logsApi.setGlobalLoggerProvider(logProvider);

  sdk = new NodeSDK({
    resource,
    spanProcessors: [exportProcessor],
    // Metrics go to the same gateway with the same key; left to environment defaults they would be
    // sent without the credential and refused.
    metricReaders: [
      new metrics.PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: `${baseUrl}/v1/metrics`, headers }),
        exportIntervalMillis: Math.max(
          5_000,
          Number(process.env.OWLPANE_METRICS_EXPORT_INTERVAL_MS?.trim()) || 30_000,
        ),
      }),
    ],
    sampler: new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(ratio),
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": off("@opentelemetry/instrumentation-fs"),
        "@opentelemetry/instrumentation-dns": off("@opentelemetry/instrumentation-dns"),
        // A tcp.connect span per socket and a span per router layer are low-value noise.
        "@opentelemetry/instrumentation-net": off("@opentelemetry/instrumentation-net"),
        "@opentelemetry/instrumentation-router": off("@opentelemetry/instrumentation-router"),
        // Each sync Express layer registers res.once("finish"). Nest + pino-http + HTTP instr. exceed
        // Node's default MaxListeners (10). Use HTTP + Nest instrumentations for request spans instead.
        "@opentelemetry/instrumentation-express": off(
          "@opentelemetry/instrumentation-express",
        ),
        // Only trace queries inside a request or job span, so idle background loops don't emit
        // hundreds of parentless query spans per minute; wrap loop iterations with job() instead.
        "@opentelemetry/instrumentation-pg": { requireParentSpan: true, ...off("@opentelemetry/instrumentation-pg") },
        // nestjs-pino → OTLP logs (Owlpane Logs page) with trace correlation when a span is active.
        "@opentelemetry/instrumentation-pino": off("@opentelemetry/instrumentation-pino"),
      }),
      ...(disabled.has("@opentelemetry/instrumentation-openai")
        ? []
        : [new OpenAIInstrumentation()]),
    ],
  });

  sdk.start();
  registerProcessMetrics(serviceName);
}

/** Flushes and stops the pipeline. Call on shutdown so the last batch of spans isn't dropped. */
export function shutdown(): Promise<void> {
  return Promise.all([sdk?.shutdown(), logProvider?.shutdown()]).then(() => undefined);
}

// ---------- Jobs ----------

export type JobKind = "cron" | "interval" | "timeout" | "queue" | "task";

let jobHistogram: api.Histogram | undefined;
function histogram(): api.Histogram {
  jobHistogram ??= api.metrics
    .getMeter("owlpane-jobs")
    .createHistogram("job.duration", {
      unit: "s",
      description: "Background job run time, by job and outcome",
      advice: {
        explicitBucketBoundaries: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 300],
      },
    });
  return jobHistogram;
}

/**
 * Runs `fn` as a traced, measured unit of background work: a root span named `name` (so the
 * work's own database/HTTP calls nest under it instead of being dropped as parentless), plus a
 * `job.duration` histogram recording (job.name, job.kind, job.outcome) that stays exact even when
 * traces are sampled. Errors are recorded on the span and re-thrown unchanged.
 */
export async function job<T>(
  name: string,
  kind: JobKind,
  attributes: api.Attributes,
  fn: () => Promise<T>,
): Promise<T> {
  const started = performance.now();
  const tracer = api.trace.getTracer("owlpane-jobs");
  return tracer.startActiveSpan(
    name,
    {
      root: true,
      kind: kind === "queue" ? api.SpanKind.CONSUMER : api.SpanKind.INTERNAL,
      attributes: { "job.name": name, "job.kind": kind, ...attributes },
    },
    async (span) => {
      let outcome: "success" | "failure" = "success";
      try {
        return await fn();
      } catch (err) {
        outcome = "failure";
        const e = err instanceof Error ? err : new Error(String(err));
        span.recordException(e);
        span.setStatus({ code: api.SpanStatusCode.ERROR, message: e.message });
        throw err;
      } finally {
        span.setAttribute("job.outcome", outcome);
        span.end();
        histogram().record((performance.now() - started) / 1000, {
          "job.name": name,
          "job.kind": kind,
          "job.outcome": outcome,
        });
      }
    },
  );
}

// ---------- Users ----------

/**
 * Tags the current trace with the signed-in user (`enduser.id`), so per-user activity and errors
 * show up in the console. Call from request middleware/an interceptor once the user is known.
 * Only the opaque id is recorded — never email or name.
 */
export function setUser(
  id: string,
  profile?: { email?: string; name?: string },
): void {
  if (!id) return;
  const span = api.trace.getActiveSpan();
  if (!span) return;
  span.setAttribute("enduser.id", id);
  if (!traceUserProfile) return;
  const email = profile?.email?.trim();
  const name = profile?.name?.trim();
  if (email) span.setAttribute("enduser.email", email);
  if (name) span.setAttribute("enduser.name", name);
}

// ---------- Process metrics ----------

/** CPU and resident memory, under semantic-convention names any OTel backend understands. */
function registerProcessMetrics(meterName: string): void {
  const meter = api.metrics.getMeter(`owlpane-process-${meterName}`);
  let lastCpu = process.cpuUsage();
  let lastAt = process.hrtime.bigint();
  meter
    .createObservableGauge("process.cpu.utilization", {
      unit: "1",
      description: "Share of one CPU core used by this process since the previous reading",
    })
    .addCallback((result) => {
      const now = process.hrtime.bigint();
      const cpu = process.cpuUsage();
      const elapsedUs = Number(now - lastAt) / 1000;
      const usedUs = cpu.user - lastCpu.user + (cpu.system - lastCpu.system);
      if (elapsedUs > 0) result.observe(usedUs / elapsedUs);
      lastCpu = cpu;
      lastAt = now;
    });
  meter
    .createObservableGauge("process.memory.usage", {
      unit: "By",
      description: "Resident set size",
    })
    .addCallback((result) => result.observe(process.memoryUsage().rss));
}

export const owlpane = { start, shutdown, job, setUser, isEnabled };
