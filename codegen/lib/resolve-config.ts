/**
 * Portable init resolution — must match @owlpane/node start() semantics.
 * Used by conformance tests and language codegen.
 */

export type InitOptions = {
  service?: string;
  endpoint?: string;
  ingestKey?: string;
  environment?: string;
  release?: string;
  sampleRatio?: number;
  resourceAttributes?: Record<string, string>;
  disableInstrumentations?: string[];
  traceUserProfile?: boolean;
};

export type ResolvedConfig = {
  baseUrl: string;
  headers: Record<string, string>;
  serviceName: string;
  version: string;
  environment: string;
  sampleRatio: number;
  traceUserProfile: boolean;
  resourceAttributes: Record<string, string>;
};

function trim(s: string | undefined): string | undefined {
  const t = s?.trim();
  return t ? t : undefined;
}

function envEndpoint(env: Record<string, string | undefined>): string | undefined {
  return trim(env.OTEL_EXPORTER_OTLP_ENDPOINT) ?? trim(env.OWLPANE_INGEST_URL);
}

function sampleRatio(
  env: Record<string, string | undefined>,
  options: InitOptions,
): number {
  if (options.sampleRatio !== undefined) return options.sampleRatio;
  const raw = trim(env.OTEL_TRACES_SAMPLER_ARG);
  if (!raw) {
    const nodeEnv = trim(env.NODE_ENV);
    return nodeEnv === "production" ? 0.1 : 1;
  }
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : 0.1;
}

function traceUserProfileEnabled(
  env: Record<string, string | undefined>,
  options: InitOptions,
): boolean {
  if (options.traceUserProfile === true) return true;
  const v = trim(env.OWLPANE_TRACE_USER_PROFILE)?.toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Returns null when SDK should not start (disabled or no endpoint). */
export function resolveInitOptions(
  env: Record<string, string | undefined>,
  options: InitOptions = {},
): ResolvedConfig | null {
  if (trim(env.OTEL_SDK_DISABLED) === "true") return null;

  const endpoint = trim(options.endpoint) ?? envEndpoint(env);
  if (!endpoint) return null;

  const serviceName =
    trim(options.service) ?? trim(env.OTEL_SERVICE_NAME) ?? "node-app";
  const version =
    trim(options.release) ?? trim(env.OWLPANE_RELEASE) ?? "0.0.0";
  const environment =
    trim(options.environment) ??
    trim(env.OWLPANE_ENVIRONMENT) ??
    trim(env.NODE_ENV) ??
    "development";
  const ingestKey = trim(options.ingestKey) ?? trim(env.OWLPANE_INGEST_KEY);

  const headers: Record<string, string> = {};
  if (ingestKey) headers.Authorization = `Bearer ${ingestKey}`;

  const baseUrl = endpoint.replace(/\/+$/, "");

  return {
    baseUrl,
    headers,
    serviceName,
    version,
    environment,
    sampleRatio: sampleRatio(env, options),
    traceUserProfile: traceUserProfileEnabled(env, options),
    resourceAttributes: { ...options.resourceAttributes },
  };
}

export function otlpUrls(baseUrl: string): { traces: string; logs: string; metrics: string } {
  const b = baseUrl.replace(/\/+$/, "");
  return {
    traces: `${b}/v1/traces`,
    logs: `${b}/v1/logs`,
    metrics: `${b}/v1/metrics`,
  };
}
