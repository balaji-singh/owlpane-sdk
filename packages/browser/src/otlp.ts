export type AttrValue = string | number | boolean;
export type Attrs = Record<string, AttrValue | undefined | null>;

export type SpanEvent = { name: string; timeMs: number; attributes?: Attrs };

export type SpanData = {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  /** OTLP SpanKind: 1 internal, 2 server, 3 client. */
  kind: 1 | 3;
  /** Epoch milliseconds (fractional allowed). */
  startMs: number;
  endMs: number;
  attributes: Attrs;
  events?: SpanEvent[];
  /** OTLP status code: 0 unset, 1 ok, 2 error. */
  status?: { code: 0 | 1 | 2; message?: string };
};

export type OtlpAnyValue = { stringValue: string } | { intValue: string } | { doubleValue: number } | { boolValue: boolean };
export type OtlpKeyValue = { key: string; value: OtlpAnyValue };

export function unixNano(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0";
  return (BigInt(Math.round(ms * 1000)) * 1000n).toString();
}

export function encodeValue(v: AttrValue): OtlpAnyValue {
  if (typeof v === "boolean") return { boolValue: v };
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return { stringValue: String(v) };
    return Number.isInteger(v) && Math.abs(v) <= Number.MAX_SAFE_INTEGER ? { intValue: String(v) } : { doubleValue: v };
  }
  return { stringValue: String(v) };
}

export function encodeAttrs(attrs: Attrs | undefined): OtlpKeyValue[] {
  const out: OtlpKeyValue[] = [];
  if (!attrs) return out;
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null) continue;
    out.push({ key, value: encodeValue(value) });
  }
  return out;
}

export function encodeSpan(s: SpanData): Record<string, unknown> {
  const o: Record<string, unknown> = {
    traceId: s.traceId,
    spanId: s.spanId,
    name: s.name,
    kind: s.kind,
    startTimeUnixNano: unixNano(s.startMs),
    endTimeUnixNano: unixNano(Math.max(s.endMs, s.startMs)),
    attributes: encodeAttrs(s.attributes),
    events: (s.events ?? []).map((e) => ({ timeUnixNano: unixNano(e.timeMs), name: e.name, attributes: encodeAttrs(e.attributes) })),
    status: s.status ? { code: s.status.code, ...(s.status.message ? { message: s.status.message } : {}) } : { code: 0 },
  };
  if (s.parentSpanId) o.parentSpanId = s.parentSpanId;
  return o;
}

export const SCOPE = { name: "@owlpane/browser" };

/** Wraps already-serialised span JSON strings into an ExportTraceServiceRequest body. */
export function buildRequestBody(resourceAttrs: Attrs, spanJson: string[], version: string): string {
  const resource = JSON.stringify({ attributes: encodeAttrs(resourceAttrs) });
  return `{"resourceSpans":[{"resource":${resource},"scopeSpans":[{"scope":${JSON.stringify({ ...SCOPE, version })},"spans":[${spanJson.join(",")}]}]}]}`;
}
