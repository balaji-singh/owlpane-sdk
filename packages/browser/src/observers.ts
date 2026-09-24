import type { Env } from "./env.js";
import type { Attrs } from "./otlp.js";
import type { ActiveSpan, ResolvedOptions, Tracer } from "./tracer.js";
import { ClsTracker, InpTracker, rate } from "./vitals.js";

type Ctx = { env: Env; opts: ResolvedOptions; tracer: Tracer; page: ActiveSpan };

function observe(env: Env, type: string, cb: (entries: any[]) => void, extra: Record<string, unknown> = {}): boolean {
  const PO = env.PerformanceObserver;
  if (!PO) return false;
  try {
    const supported: string[] | undefined = PO.supportedEntryTypes;
    if (supported && !supported.includes(type)) return false;
    const po = new PO((list: any) => {
      try {
        cb(list.getEntries());
      } catch {
        /* ignore */
      }
    });
    po.observe({ type, buffered: true, ...extra });
    return true;
  } catch {
    return false;
  }
}

/**
 * Emits one 'documentLoad' span covering navigation start..loadEventEnd. Phase timings are
 * attributes (milliseconds relative to navigation start) rather than child spans, to keep volume low.
 */
export function captureDocumentLoad(c: Ctx): void {
  const { env } = c;
  const run = () => {
    try {
      const nav: any = env.performance?.getEntriesByType?.("navigation")?.[0];
      const origin = env.performance?.timeOrigin ?? env.now();
      const attrs: Attrs = {};
      let end = env.now();
      if (nav) {
        const ms = (v: unknown) => (typeof v === "number" && v >= 0 ? Math.round(v * 100) / 100 : undefined);
        attrs["browser.navigation.type"] = nav.type;
        attrs["browser.timing.redirect_ms"] = ms(nav.redirectEnd - nav.redirectStart);
        attrs["browser.timing.dns_ms"] = ms(nav.domainLookupEnd - nav.domainLookupStart);
        attrs["browser.timing.connect_ms"] = ms(nav.connectEnd - nav.connectStart);
        attrs["browser.timing.ttfb_ms"] = ms(nav.responseStart - nav.startTime);
        attrs["browser.timing.response_ms"] = ms(nav.responseEnd - nav.responseStart);
        attrs["browser.timing.dom_interactive_ms"] = ms(nav.domInteractive);
        attrs["browser.timing.dom_content_loaded_ms"] = ms(nav.domContentLoadedEventEnd);
        attrs["browser.timing.load_ms"] = ms(nav.loadEventEnd);
        attrs["browser.timing.transfer_size_bytes"] = ms(nav.transferSize);
        if (nav.loadEventEnd > 0) end = origin + nav.loadEventEnd;
      }
      c.page.end({ endMs: end, attributes: attrs });
    } catch {
      /* ignore */
    }
  };
  if (env.document?.readyState === "complete") env.setTimeout?.(run, 0);
  else env.addEventListener?.("load", () => env.setTimeout?.(run, 0));
}

export type VitalsHandle = { report(): void };

/**
 * LCP / CLS / INP via PerformanceObserver. Values keep updating while the page is alive and are
 * reported once, when the page is hidden (or `report()` is called), as spans named 'webvital.<NAME>'.
 */
export function captureVitals(c: Ctx): VitalsHandle {
  const { env } = c;
  let lcp: number | undefined;
  const cls = new ClsTracker();
  const inp = new InpTracker();
  let clsSeen = false;
  let reported = false;

  observe(env, "largest-contentful-paint", (es) => {
    for (const e of es) lcp = e.renderTime || e.loadTime || e.startTime;
  });
  observe(env, "layout-shift", (es) => {
    for (const e of es) {
      clsSeen = true;
      cls.add(e);
    }
  });
  observe(env, "event", (es) => es.forEach((e) => inp.add(e)), { durationThreshold: 40 });

  function emit(name: "LCP" | "CLS" | "INP", value: number, extra: Attrs = {}) {
    const now = env.now();
    const s = c.tracer.start(`webvital.${name}`, 1, {
      traceId: c.page.traceId,
      parentSpanId: c.page.spanId,
      sampled: c.page.sampled,
      startMs: now,
      attributes: { "webvital.name": name, "webvital.value": name === "CLS" ? Math.round(value * 10000) / 10000 : Math.round(value * 100) / 100, "webvital.unit": name === "CLS" ? "score" : "ms", "webvital.rating": rate(name, value), ...extra },
    });
    s.end({ endMs: now });
  }

  function report() {
    if (reported) return;
    reported = true;
    try {
      if (lcp !== undefined) emit("LCP", lcp);
      if (clsSeen || lcp !== undefined) emit("CLS", cls.value);
      const v = inp.value;
      if (v !== undefined) emit("INP", v, { "webvital.interactions": inp.count });
    } catch {
      /* ignore */
    }
  }
  return { report };
}

function errorInfo(x: unknown): { type: string; message: string; stack?: string } {
  if (x && typeof x === "object" && ("message" in x || "stack" in x)) {
    const e = x as { name?: string; message?: unknown; stack?: unknown };
    return { type: String(e.name || "Error"), message: String(e.message ?? ""), stack: typeof e.stack === "string" ? e.stack : undefined };
  }
  return { type: typeof x === "string" ? "string" : "UnknownError", message: typeof x === "string" ? x : safeString(x) };
}

function safeString(x: unknown): string {
  try {
    return typeof x === "object" ? JSON.stringify(x) ?? String(x) : String(x);
  } catch {
    return String(x);
  }
}

export type ErrorReporter = (error: unknown, source: string, where?: { file?: string; line?: number; col?: number }) => void;

/** Records an error as a span with an OTLP 'exception' event (same attribute names as the Node SDK / OTel). */
export function createErrorReporter(c: Ctx): ErrorReporter {
  let count = 0;
  return (error, source, where) => {
    try {
      if (count >= c.opts.maxErrorsPerPage) return;
      count++;
      const info = errorInfo(error);
      const now = c.env.now();
      const s = c.tracer.start("exception", 1, {
        traceId: c.page.traceId,
        parentSpanId: c.page.spanId,
        sampled: c.page.sampled,
        startMs: now,
        attributes: { "owlpane.error.source": source, "code.filepath": where?.file, "code.lineno": where?.line, "code.column": where?.col },
      });
      s.end({
        endMs: now,
        status: { code: 2, message: info.message.slice(0, 500) },
        events: [
          {
            name: "exception",
            timeMs: now,
            attributes: { "exception.type": info.type, "exception.message": info.message.slice(0, 2000), "exception.stacktrace": info.stack?.slice(0, 8000), "exception.escaped": true },
          },
        ],
      });
    } catch {
      /* ignore */
    }
  };
}

export function captureErrors(c: Ctx, report: ErrorReporter): void {
  const add = c.env.addEventListener;
  if (!add) return;
  add("error", (ev: any) => {
    // Resource load errors have no `message`; skip them.
    if (!ev || (ev.message === undefined && ev.error === undefined)) return;
    report(ev.error ?? ev.message, "onerror", { file: ev.filename ? String(ev.filename).split(/[?#]/)[0] : undefined, line: ev.lineno, col: ev.colno });
  });
  add("unhandledrejection", (ev: any) => report(ev?.reason, "unhandledrejection"));
}
