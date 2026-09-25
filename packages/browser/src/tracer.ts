import type { Env } from "./env.js";
import { RandomBytes, defaultRandomBytes, newSpanId, newTraceId } from "./ids.js";
import type { Attrs, SpanData, SpanEvent } from "./otlp.js";

export const VERSION = "0.1.3";

export type ResolvedOptions = {
  endpoint: string;
  projectKey: string;
  serviceName: string;
  environment?: string;
  release?: string;
  sampleRate: number;
  propagateTraceTo: (string | RegExp)[];
  keepQuery: boolean;
  maxErrorsPerPage: number;
};

export type ActiveSpan = {
  traceId: string;
  spanId: string;
  sampled: boolean;
  end(o?: { status?: SpanData["status"]; attributes?: Attrs; events?: SpanEvent[]; endMs?: number }): void;
};

/** Creates spans, stamps the attributes every RUM span carries, and hands finished spans to `emit`. */
export type Tracer = ReturnType<typeof createTracer>;

export function createTracer(env: Env, opts: ResolvedOptions, emit: (s: SpanData) => void, sessionId: string, pageUrl: () => { url: string; path: string }, pageAttrs: Attrs = {}) {
  const rand: RandomBytes = env.randomBytes ?? defaultRandomBytes();
  const nav = env.navigator;

  function common(): Attrs {
    const p = pageUrl();
    return {
      "owlpane.rum": "true",
      "session.id": sessionId,
      "browser.page.url": p.url,
      "browser.page.path": p.path,
      "user_agent.original": nav?.userAgent,
      "browser.language": nav?.language,
      "browser.platform": nav?.userAgentData?.platform ?? nav?.platform,
      "browser.mobile": nav?.userAgentData?.mobile,
      ...pageAttrs,
    };
  }

  function sample(): boolean {
    return opts.sampleRate >= 1 ? true : opts.sampleRate <= 0 ? false : env.random() < opts.sampleRate;
  }

  function start(name: string, kind: 1 | 3, o: { traceId?: string; parentSpanId?: string; sampled?: boolean; startMs?: number; attributes?: Attrs } = {}): ActiveSpan {
    const traceId = o.traceId ?? newTraceId(rand);
    const spanId = newSpanId(rand);
    const sampled = o.sampled ?? sample();
    const startMs = o.startMs ?? env.now();
    const startAttrs = o.attributes ?? {};
    let done = false;
    return {
      traceId,
      spanId,
      sampled,
      end(e = {}) {
        if (done) return;
        done = true;
        if (!sampled) return;
        try {
          emit({
            traceId,
            spanId,
            parentSpanId: o.parentSpanId,
            name,
            kind,
            startMs,
            endMs: e.endMs ?? env.now(),
            attributes: { ...common(), ...startAttrs, ...e.attributes },
            events: e.events,
            status: e.status,
          });
        } catch {
          /* never throw into the host app */
        }
      },
    };
  }

  return { start, sample, common, rand, newTraceId: () => newTraceId(rand), newSpanId: () => newSpanId(rand) };
}
