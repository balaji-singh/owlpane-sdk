import type { Env } from "./env.js";
import { formatTraceparent } from "./ids.js";
import type { Attrs } from "./otlp.js";
import type { ResolvedOptions, Tracer } from "./tracer.js";
import { sanitizeUrl, shouldPropagate } from "./url.js";

type Ctx = { env: Env; opts: ResolvedOptions; tracer: Tracer; isOwnUrl: (abs: string) => boolean };

function baseHref(env: Env): string | undefined {
  return env.location?.href;
}

function httpAttrs(c: Ctx, method: string, raw: string): Attrs {
  const base = baseHref(c.env);
  const url = sanitizeUrl(raw, base, c.opts.keepQuery);
  return {
    "http.request.method": method.toUpperCase(),
    "url.full": url,
    "server.address": (() => {
      try {
        return new URL(raw, base).hostname;
      } catch {
        return undefined;
      }
    })(),
  };
}

function errStatus(code: number | undefined): { code: 0 | 1 | 2; message?: string } {
  return code !== undefined && code >= 400 ? { code: 2, message: `HTTP ${code}` } : { code: 0 };
}

function absolute(c: Ctx, raw: string): string {
  try {
    return new URL(raw, baseHref(c.env)).toString();
  } catch {
    return raw;
  }
}

/** Replaces `global.fetch` with an instrumented wrapper. Returns an undo function. */
export function instrumentFetch(c: Ctx, original: NonNullable<Env["fetch"]>): () => void {
  const g = c.env.global;
  if (!g) return () => undefined;
  const wrapped = function (this: unknown, input: any, init?: any): Promise<any> {
    let span: ReturnType<Tracer["start"]> | undefined;
    let callArgs: any[] = [input, init];
    try {
      const isReq = c.env.Request && input instanceof c.env.Request;
      const raw: string = typeof input === "string" ? input : isReq ? input.url : String(input?.href ?? input);
      if (c.isOwnUrl(absolute(c, raw))) return original(input, init);
      const method: string = String(init?.method ?? (isReq ? input.method : "GET"));
      span = c.tracer.start("HTTP " + method.toUpperCase(), 3, { attributes: httpAttrs(c, method, raw) });
      if (shouldPropagate(raw, baseHref(c.env), c.opts.propagateTraceTo) && c.env.Headers) {
        try {
          const headers = new c.env.Headers(init?.headers ?? (isReq ? input.headers : undefined));
          if (!headers.has("traceparent")) {
            headers.set("traceparent", formatTraceparent(span.traceId, span.spanId, span.sampled));
            callArgs = [input, { ...init, headers }];
          }
        } catch {
          callArgs = [input, init];
        }
      }
    } catch {
      return original(input, init);
    }
    const s = span;
    let p: Promise<any>;
    try {
      p = original(...callArgs);
    } catch (e) {
      s.end({ status: { code: 2, message: String((e as Error)?.message ?? e) }, attributes: { "error.type": (e as Error)?.name ?? "Error" } });
      throw e;
    }
    return p.then(
      (res) => {
        try {
          const code = typeof res?.status === "number" ? res.status : undefined;
          s.end({ status: errStatus(code), attributes: { "http.response.status_code": code, "error.type": code !== undefined && code >= 400 ? String(code) : undefined } });
        } catch {
          /* ignore */
        }
        return res;
      },
      (e) => {
        try {
          s.end({ status: { code: 2, message: String(e?.message ?? e) }, attributes: { "error.type": e?.name ?? "Error" } });
        } catch {
          /* ignore */
        }
        throw e;
      },
    );
  };
  g.fetch = wrapped;
  return () => {
    if (g.fetch === wrapped) g.fetch = original;
  };
}

const KEY = Symbol.for("owlpane.xhr");

/** Patches XMLHttpRequest.prototype open/send. Returns an undo function. */
export function instrumentXhr(c: Ctx): () => void {
  const X = c.env.XMLHttpRequest;
  const proto = X?.prototype;
  if (!proto || typeof proto.open !== "function" || typeof proto.send !== "function") return () => undefined;
  const origOpen = proto.open;
  const origSend = proto.send;

  proto.open = function (this: any, method: string, url: any, ...rest: any[]) {
    try {
      this[KEY] = { method: String(method), raw: String(url?.href ?? url) };
    } catch {
      /* ignore */
    }
    return origOpen.call(this, method, url, ...rest);
  };

  proto.send = function (this: any, ...args: any[]) {
    try {
      const meta = this[KEY];
      if (meta && !c.isOwnUrl(absolute(c, meta.raw))) {
        const span = c.tracer.start("HTTP " + meta.method.toUpperCase(), 3, { attributes: httpAttrs(c, meta.method, meta.raw) });
        if (shouldPropagate(meta.raw, baseHref(c.env), c.opts.propagateTraceTo) && typeof this.setRequestHeader === "function") {
          try {
            this.setRequestHeader("traceparent", formatTraceparent(span.traceId, span.spanId, span.sampled));
          } catch {
            /* ignore */
          }
        }
        let finished = false;
        const finish = (kind?: string) => {
          if (finished) return;
          finished = true;
          try {
            const code: number | undefined = typeof this.status === "number" && this.status > 0 ? this.status : undefined;
            if (code === undefined || kind) {
              span.end({ status: { code: 2, message: kind ?? "network error" }, attributes: { "error.type": kind ?? "network_error" } });
            } else {
              span.end({ status: errStatus(code), attributes: { "http.response.status_code": code, "error.type": code >= 400 ? String(code) : undefined } });
            }
          } catch {
            /* ignore */
          }
        };
        if (typeof this.addEventListener === "function") {
          this.addEventListener("abort", () => finish("abort"));
          this.addEventListener("timeout", () => finish("timeout"));
          this.addEventListener("loadend", () => finish());
        }
      }
    } catch {
      /* fall through to the real send */
    }
    return origSend.apply(this, args);
  };

  return () => {
    proto.open = origOpen;
    proto.send = origSend;
  };
}

