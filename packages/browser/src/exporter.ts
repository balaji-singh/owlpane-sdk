import { Attrs, SpanData, buildRequestBody, encodeSpan } from "./otlp.js";
import { SpanQueue } from "./queue.js";

export type FetchLike = (input: string, init: { method: string; headers: Record<string, string>; body: string; keepalive: boolean; credentials?: "omit" }) => Promise<unknown>;

export type ExporterOptions = {
  /** Full OTLP traces URL, e.g. https://ingest.example.com/v1/traces */
  url: string;
  projectKey: string;
  resource: Attrs;
  version: string;
  /** The ORIGINAL (un-instrumented) fetch. */
  fetch: FetchLike | undefined;
  setTimeout?: (fn: () => void, ms: number) => unknown;
  clearTimeout?: (h: unknown) => void;
  flushIntervalMs?: number;
  maxBatchSpans?: number;
  maxQueueSpans?: number;
  /** Per-request body cap. Browsers cap keepalive fetch bodies at 64 KiB, so stay under it. */
  maxPayloadBytes?: number;
};

export type Exporter = { enqueue(span: SpanData): void; flush(): Promise<void>; readonly queue: SpanQueue; stop(): void };

/** Batches spans and posts OTLP/HTTP JSON. Never throws and never rejects. */
export function createExporter(o: ExporterOptions): Exporter {
  const st = o.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));
  const ct = o.clearTimeout ?? ((h) => clearTimeout(h as never));
  const interval = o.flushIntervalMs ?? 5000;
  const maxBatch = o.maxBatchSpans ?? 100;
  const maxPayload = o.maxPayloadBytes ?? 60_000;
  const queue = new SpanQueue(o.maxQueueSpans ?? 500);
  let timer: unknown;
  let stopped = false;
  // Leave room for the envelope (resource + scope) when sizing batches.
  const envelope = buildRequestBody(o.resource, [], o.version).length + 64;

  function schedule() {
    if (timer !== undefined || stopped) return;
    timer = st(() => {
      timer = undefined;
      void flush();
    }, interval);
  }

  function enqueue(span: SpanData) {
    if (stopped) return;
    try {
      const json = JSON.stringify(encodeSpan(span));
      queue.push({ json, bytes: json.length + 1 });
      if (queue.size >= maxBatch) void flush();
      else schedule();
    } catch {
      /* never throw into the host app */
    }
  }

  /** Starts every request synchronously (important on pagehide), then resolves when all settle. */
  function flush(): Promise<void> {
    if (timer !== undefined) {
      ct(timer);
      timer = undefined;
    }
    const pending: Promise<unknown>[] = [];
    try {
      while (queue.size) {
        const batch = queue.take(maxBatch, Math.max(1000, maxPayload - envelope));
        if (!batch.length) continue;
        const body = buildRequestBody(o.resource, batch.map((b) => b.json), o.version);
        try {
          const f = o.fetch;
          if (!f) continue;
          pending.push(
            Promise.resolve(
              f(o.url, {
                method: "POST",
                headers: { "content-type": "application/json", authorization: `Bearer ${o.projectKey}` },
                body,
                keepalive: true,
                credentials: "omit",
              }),
            ).catch(() => undefined),
          );
        } catch {
          /* dropped: telemetry is best-effort */
        }
      }
    } catch {
      /* ignore */
    }
    return Promise.all(pending).then(() => undefined);
  }

  return {
    enqueue,
    flush,
    queue,
    stop() {
      stopped = true;
      if (timer !== undefined) ct(timer);
      timer = undefined;
    },
  };
}
