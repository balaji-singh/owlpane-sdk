import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { Env } from "../src/env.js";
import { init } from "../src/index.js";
import { parseTraceparent } from "../src/ids.js";

class FakePO {
  static supportedEntryTypes = ["largest-contentful-paint", "layout-shift", "event"];
  static all: FakePO[] = [];
  type = "";
  constructor(public cb: (l: { getEntries(): any[] }) => void) {
    FakePO.all.push(this);
  }
  observe(o: { type: string }) {
    this.type = o.type;
  }
  emit(entries: any[]) {
    this.cb({ getEntries: () => entries });
  }
}

class FakeXHR {
  status = 0;
  listeners: Record<string, (() => void)[]> = {};
  headers: Record<string, string> = {};
  addEventListener(t: string, f: () => void) {
    (this.listeners[t] ??= []).push(f);
  }
  setRequestHeader(k: string, v: string) {
    this.headers[k] = v;
  }
  open(..._a: unknown[]) {}
  send(..._a: unknown[]) {}
  fire(t: string) {
    (this.listeners[t] ?? []).forEach((f) => f());
  }
}

const val = (v: any) => (v.intValue !== undefined ? Number(v.intValue) : Object.values(v)[0]);

type Harness = ReturnType<typeof make>;
let cur: ReturnType<typeof init> | undefined;

function make(fetchImpl?: (url: any, init?: any) => Promise<any>) {
  FakePO.all = [];
  const listeners: Record<string, ((ev: any) => void)[]> = {};
  const calls: { url: any; init?: any }[] = [];
  const g: Record<string, any> = {};
  const fetch = async (url: any, init?: any) => {
    calls.push({ url, init });
    return fetchImpl ? fetchImpl(url, init) : { status: 200 };
  };
  g.fetch = fetch;
  const store = new Map<string, string>();
  const env: Env = {
    global: g,
    fetch,
    Headers: globalThis.Headers,
    Request: globalThis.Request,
    XMLHttpRequest: FakeXHR,
    PerformanceObserver: FakePO,
    addEventListener: (t, f) => void (listeners[t] ??= []).push(f),
    location: { href: "https://app.example.com/orders/42?email=a@b.c#x" },
    document: { visibilityState: "visible", readyState: "loading" },
    navigator: { userAgent: "UA/1", language: "en" },
    performance: { timeOrigin: 1_700_000_000_000, now: () => 5, getEntriesByType: () => [{ type: "navigate", startTime: 0, responseStart: 40, responseEnd: 60, domInteractive: 100, domContentLoadedEventEnd: 120, loadEventEnd: 200, transferSize: 5000 }] },
    storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v) },
    setTimeout: (fn) => (fn(), 0),
    clearTimeout: () => undefined,
    now: () => 1_700_000_000_500,
    random: () => 0.5,
  };
  const fire = (t: string, ev: any = {}) => (listeners[t] ?? []).forEach((f) => f(ev));
  return { env, g, calls, fire, store };
}

/** Parses all spans exported so far (calls to the ingest endpoint). */
function exported(h: Harness) {
  const out: any[] = [];
  for (const c of h.calls) {
    if (!String(c.url).includes("/v1/traces")) continue;
    const rs = JSON.parse(c.init.body).resourceSpans[0];
    for (const s of rs.scopeSpans[0].spans) out.push({ ...s, attrs: Object.fromEntries(s.attributes.map((a: any) => [a.key, val(a.value)])), resource: rs.resource });
  }
  return out;
}

const start = (h: Harness, extra: object = {}) => {
  cur = init({ endpoint: "https://ingest.example.com/", projectKey: "owl_ing_" + "a".repeat(48), serviceName: "web", environment: "prod", release: "1.2.3", env: h.env, ...extra });
  return cur;
};

afterEach(async () => {
  await cur?.shutdown();
  cur = undefined;
});

test("fetch: client span, traceparent for same-origin only, own export not instrumented", async () => {
  const h = make((url) => Promise.resolve({ status: String(url).includes("missing") ? 404 : 200 }));
  const rum = start(h, { propagateTraceTo: ["https://api.example.com"] });
  await h.g.fetch("/api/orders?secret=1");
  await h.g.fetch("https://api.example.com/v1/x", { method: "POST", headers: { "x-a": "1" } });
  await h.g.fetch("https://third.party.io/pixel");
  await h.g.fetch("/api/missing");
  const req = new Request("https://app.example.com/api/req", { headers: { "x-r": "1" } });
  await h.g.fetch(req);
  await rum.flush();

  const app = h.calls.filter((c) => !String(c.url).includes("/v1/traces"));
  const tp = (i: number) => new Headers(app[i].init?.headers).get("traceparent");
  assert.ok(parseTraceparent(tp(0)!), "same-origin gets traceparent");
  assert.ok(parseTraceparent(tp(1)!), "allow-listed gets traceparent");
  assert.equal(new Headers(app[1].init.headers).get("x-a"), "1", "existing headers preserved");
  assert.equal(tp(2), null, "third party gets none");
  assert.equal(new Headers(app[4].init.headers).get("x-r"), "1", "Request headers preserved");
  assert.ok(parseTraceparent(tp(4)!));

  const spans = exported(h).filter((s) => s.kind === 3);
  assert.equal(spans.length, 5, "export requests themselves produce no spans");
  const first = spans[0];
  assert.equal(first.attrs["http.request.method"], "GET");
  assert.equal(first.attrs["url.full"], "https://app.example.com/api/orders");
  assert.equal(first.attrs["http.response.status_code"], 200);
  assert.equal(first.attrs["owlpane.rum"], "true");
  // trace id in header matches the span
  assert.equal(parseTraceparent(tp(0)!)!.traceId, first.traceId);
  assert.equal(parseTraceparent(tp(0)!)!.spanId, first.spanId);
  assert.equal(spans[1].attrs["http.request.method"], "POST");
  const nf = spans[3];
  assert.deepEqual(nf.status, { code: 2, message: "HTTP 404" });
  assert.equal(nf.attrs["http.response.status_code"], 404);
});

test("fetch: network failure yields error span and rethrows", async () => {
  const h = make(() => Promise.reject(new TypeError("Failed to fetch")));
  const rum = start(h);
  await assert.rejects(h.g.fetch("/api/x"), /Failed to fetch/);
  await rum.flush();
  const s = exported(h).find((x) => x.kind === 3)!;
  assert.equal(s.status.code, 2);
  assert.equal(s.attrs["error.type"], "TypeError");
});

test("XHR: span, traceparent, status and abort handling", async () => {
  const h = make();
  const rum = start(h);
  const x = new FakeXHR() as any;
  x.open("GET", "/api/xhr?a=1");
  x.send();
  x.status = 500;
  x.fire("loadend");
  const y = new FakeXHR() as any;
  y.open("POST", "https://other.io/a");
  y.send();
  y.fire("abort");
  y.fire("loadend");
  await rum.flush();
  assert.ok(parseTraceparent(x.headers.traceparent));
  assert.equal(y.headers.traceparent, undefined);
  const spans = exported(h).filter((s) => s.kind === 3);
  assert.equal(spans.length, 2);
  assert.equal(spans[0].attrs["http.response.status_code"], 500);
  assert.equal(spans[0].status.code, 2);
  assert.equal(spans[0].attrs["url.full"], "https://app.example.com/api/xhr");
  assert.equal(spans[1].attrs["error.type"], "abort");
});

test("errors and unhandled rejections become spans with an exception event", async () => {
  const h = make();
  const rum = start(h);
  h.fire("error", { message: "boom", error: new RangeError("boom"), filename: "https://app.example.com/a.js?v=1", lineno: 3, colno: 9 });
  h.fire("error", {}); // resource error: ignored
  h.fire("unhandledrejection", { reason: "plain string" });
  rum.captureException(new Error("manual"));
  await rum.flush();
  const ex = exported(h).filter((s) => s.name === "exception");
  assert.equal(ex.length, 3);
  const ev = ex[0].events[0];
  const a = Object.fromEntries(ev.attributes.map((x: any) => [x.key, val(x.value)]));
  assert.equal(ev.name, "exception");
  assert.equal(a["exception.type"], "RangeError");
  assert.equal(a["exception.message"], "boom");
  assert.match(String(a["exception.stacktrace"]), /RangeError: boom/);
  assert.equal(ex[0].attrs["code.filepath"], "https://app.example.com/a.js");
  assert.equal(ex[0].attrs["owlpane.error.source"], "onerror");
  assert.equal(ex[1].attrs["owlpane.error.source"], "unhandledrejection");
  assert.equal(ex[1].events[0].attributes.find((x: any) => x.key === "exception.type").value.stringValue, "string");
  assert.equal(ex[0].status.code, 2);
});

test("documentLoad, vitals on hidden, resource + common attributes, path sanitised", async () => {
  const h = make();
  const rum = start(h, { sampleRate: 1 });
  h.fire("load");
  const po = (t: string) => FakePO.all.find((p) => p.type === t)!;
  po("largest-contentful-paint").emit([{ startTime: 900 }, { renderTime: 1800, startTime: 1800 }]);
  po("layout-shift").emit([{ value: 0.05, startTime: 100 }, { value: 0.07, startTime: 400 }]);
  po("event").emit([{ interactionId: 1, duration: 250 }]);
  h.env.document!.visibilityState = "hidden";
  h.fire("visibilitychange");
  h.fire("pagehide"); // second report is a no-op
  await rum.flush();

  const spans = exported(h);
  const names = spans.map((s) => s.name);
  assert.deepEqual(names.filter((n) => n.startsWith("webvital.")).sort(), ["webvital.CLS", "webvital.INP", "webvital.LCP"]);
  assert.equal(names.filter((n) => n === "documentLoad").length, 1);
  const dl = spans.find((s) => s.name === "documentLoad")!;
  assert.equal(dl.attrs["browser.timing.load_ms"], 200);
  assert.equal(dl.attrs["browser.timing.ttfb_ms"], 40);
  assert.equal(dl.attrs["browser.page.path"], "/orders/42");
  assert.equal(dl.attrs["browser.page.url"], "https://app.example.com/orders/42");
  assert.equal(dl.attrs["user_agent.original"], "UA/1");
  assert.equal(dl.attrs["session.id"], rum.sessionId);
  assert.match(rum.sessionId, /^[0-9a-f]{16}$/);
  const lcp = spans.find((s) => s.name === "webvital.LCP")!;
  assert.equal(lcp.attrs["webvital.value"], 1800);
  assert.equal(lcp.attrs["webvital.rating"], "good");
  assert.equal(lcp.traceId, dl.traceId);
  assert.equal(lcp.parentSpanId, dl.spanId);
  assert.equal(spans.find((s) => s.name === "webvital.CLS")!.attrs["webvital.value"], 0.12);
  assert.equal(spans.find((s) => s.name === "webvital.INP")!.attrs["webvital.rating"], "needs-improvement");
  const res = Object.fromEntries(dl.resource.attributes.map((a: any) => [a.key, val(a.value)]));
  assert.equal(res["service.name"], "web");
  assert.equal(res["service.version"], "1.2.3");
  assert.equal(res["deployment.environment.name"], "prod");
  assert.equal(res["telemetry.sdk.language"], "webjs");
  assert.equal(res["owlpane.rum"], "true");
  // auth header on export
  const c = h.calls.find((x) => String(x.url).includes("/v1/traces"))!;
  assert.equal(c.url, "https://ingest.example.com/v1/traces");
  assert.match(c.init.headers.authorization, /^Bearer owl_ing_[a]{48}$/);
});

test("session id persists via storage and survives throwing storage", () => {
  const h = make();
  h.store.set("owlpane.sid", "0123456789abcdef");
  const a = start(h);
  assert.equal(a.sessionId, "0123456789abcdef");
  const h2 = make();
  h2.env.storage = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } };
  cur = undefined;
  return a.shutdown().then(() => {
    const b = start(h2);
    assert.match(b.sessionId, /^[0-9a-f]{16}$/);
  });
});

test("sampleRate 0 exports nothing but still forwards traceparent unsampled", async () => {
  const h = make();
  const rum = start(h, { sampleRate: 0 });
  await h.g.fetch("/api/a");
  await rum.flush();
  assert.equal(exported(h).length, 0);
  assert.equal(parseTraceparent(new Headers(h.calls[0].init.headers).get("traceparent")!)!.sampled, false);
});

test("init never throws on a hostile environment", () => {
  const bad = { ...make().env, addEventListener: () => { throw new Error("x"); }, PerformanceObserver: class { constructor() { throw new Error("no"); } } } as unknown as Env;
  assert.doesNotThrow(() => init({ projectKey: "k", serviceName: "s", env: bad }));
  assert.doesNotThrow(() => init({ projectKey: "", serviceName: "" }));
});
