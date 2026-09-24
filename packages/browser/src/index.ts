import { Env, browserEnv } from "./env.js";
import { createExporter } from "./exporter.js";
import { defaultRandomBytes, newSpanId, newTraceId } from "./ids.js";
import { instrumentFetch, instrumentXhr } from "./instrument-http.js";
import { captureDocumentLoad, captureErrors, captureVitals, createErrorReporter } from "./observers.js";
import { startDomReplay } from "./dom-replay.js";
import { ResolvedOptions, VERSION, createTracer } from "./tracer.js";
import { sanitizeUrl, urlPath } from "./url.js";

export type OwlpaneBrowserOptions = {
  /** Ingest base URL, e.g. 'https://ingest.example.com'. `/v1/traces` is appended. */
  endpoint?: string;
  /** Ingest key ('owl_ing_...'), sent as `Authorization: Bearer <key>`. */
  projectKey: string;
  serviceName: string;
  environment?: string;
  release?: string;
  /** 0..1 share of page views/requests/errors kept (decided per trace). Default 1. */
  sampleRate?: number;
  /** Extra URL prefixes / regexes that receive a `traceparent` header. Same-origin always does. */
  propagateTraceTo?: (string | RegExp)[];
  /** Keep the query string in recorded URLs (default false: stripped to avoid leaking PII). */
  keepQuery?: boolean;
  /** Max exception spans per page view (default 20). */
  maxErrorsPerPage?: number;
  /** Test seam: replaces browser globals. */
  env?: Env;
  /** Record rrweb DOM to OTLP logs (requires server OWLPANE_DOM_REPLAY_ENABLED). */
  recordDomReplay?: boolean;
};

export type OwlpaneBrowser = {
  sessionId: string;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
  captureException(error: unknown): void;
};

export const DEFAULT_ENDPOINT = "https://ingest.owlpane.com";

let active: OwlpaneBrowser | undefined;

const NOOP: OwlpaneBrowser = { sessionId: "", flush: async () => undefined, shutdown: async () => undefined, captureException: () => undefined };

function sessionIdFor(env: Env, rand: (n: number) => Uint8Array): string {
  const K = "owlpane.sid";
  try {
    const v = env.storage?.getItem(K);
    if (v && /^[0-9a-f]{16}$/.test(v)) return v;
  } catch {
    /* storage may throw (privacy mode) */
  }
  const id = newSpanId(rand);
  try {
    env.storage?.setItem(K, id);
  } catch {
    /* ignore */
  }
  return id;
}

/** Starts RUM collection. Safe to call once per page; never throws. */
export function init(options: OwlpaneBrowserOptions): OwlpaneBrowser {
  try {
    if (active) return active;
    const env = options.env ?? browserEnv();
    if (!options.projectKey || !options.serviceName) return NOOP;
    const opts: ResolvedOptions = {
      endpoint: (options.endpoint || DEFAULT_ENDPOINT).replace(/\/+$/, ""),
      projectKey: options.projectKey,
      serviceName: options.serviceName,
      environment: options.environment,
      release: options.release,
      sampleRate: options.sampleRate ?? 1,
      propagateTraceTo: options.propagateTraceTo ?? [],
      keepQuery: options.keepQuery ?? false,
      maxErrorsPerPage: options.maxErrorsPerPage ?? 20,
    };
    const tracesUrl = `${opts.endpoint}/v1/traces`;
    const originalFetch = env.fetch; // captured BEFORE patching: exports must not be instrumented
    const rand = env.randomBytes ?? defaultRandomBytes();
    const sessionId = sessionIdFor(env, rand);

    const resource = {
      "service.name": opts.serviceName,
      "service.version": opts.release,
      "deployment.environment.name": opts.environment,
      "deployment.environment": opts.environment,
      "telemetry.sdk.name": "owlpane-browser",
      "telemetry.sdk.language": "webjs",
      "telemetry.sdk.version": VERSION,
      "owlpane.rum": "true",
    };
    const exporter = createExporter({
      url: tracesUrl,
      projectKey: opts.projectKey,
      version: VERSION,
      fetch: originalFetch as never,
      setTimeout: env.setTimeout,
      clearTimeout: env.clearTimeout,
      resource,
    });

    const pageUrl = () => {
      const href = env.location?.href ?? "";
      return { url: sanitizeUrl(href, undefined, opts.keepQuery), path: urlPath(href, undefined) };
    };
    const tracer = createTracer(env, opts, (s) => exporter.enqueue(s), sessionId, pageUrl);
    const isOwnUrl = (abs: string) => abs.startsWith(opts.endpoint + "/") || abs === opts.endpoint;

    // One trace per page view: 'documentLoad' is its root; vitals and errors hang off it.
    const page = tracer.start("documentLoad", 1, { traceId: newTraceId(rand), startMs: env.performance?.timeOrigin ?? env.now() });
    const ctx = { env, opts, tracer, page };

    const undo: (() => void)[] = [];
    if (originalFetch) undo.push(instrumentFetch({ env, opts, tracer, isOwnUrl }, originalFetch));
    undo.push(instrumentXhr({ env, opts, tracer, isOwnUrl }));

    const report = createErrorReporter(ctx);
    captureErrors(ctx, report);
    captureDocumentLoad(ctx);
    const vitals = captureVitals(ctx);

    const hide = () => {
      vitals.report();
      void exporter.flush();
    };
    env.addEventListener?.("visibilitychange", () => {
      if (env.document?.visibilityState === "hidden") hide();
    });
    env.addEventListener?.("pagehide", hide);

    let stopDomReplay: (() => void) | undefined;
    if (options.recordDomReplay) {
      stopDomReplay = startDomReplay({
        logsUrl: `${opts.endpoint}/v1/logs`,
        projectKey: opts.projectKey,
        sessionId,
        resource,
        fetch: originalFetch as never,
      });
    }

    active = {
      sessionId,
      flush: () => exporter.flush(),
      captureException: (e) => report(e, "manual"),
      async shutdown() {
        stopDomReplay?.();
        undo.forEach((u) => u());
        exporter.stop();
        await exporter.flush();
        active = undefined;
      },
    };
    return active;
  } catch {
    return NOOP;
  }
}

export { newSpanId, newTraceId };
export { formatTraceparent, parseTraceparent } from "./ids.js";
export { sanitizeUrl, shouldPropagate } from "./url.js";
export { startDomReplay } from "./dom-replay.js";
