import assert from "node:assert/strict";
import { test } from "node:test";
import { createExporter } from "../src/exporter.js";
import { formatTraceparent, newSpanId, newTraceId, parseTraceparent } from "../src/ids.js";
import { SpanData, buildRequestBody, encodeSpan, encodeValue, unixNano } from "../src/otlp.js";
import { SpanQueue } from "../src/queue.js";
import { sanitizeUrl, shouldPropagate } from "../src/url.js";
import { ClsTracker, InpTracker, rate } from "../src/vitals.js";

const seqRand = (n: number) => Uint8Array.from({ length: n }, (_, i) => i + 1);

test("traceparent generate/parse round trip and rejection", () => {
  const t = newTraceId(seqRand);
  const s = newSpanId(seqRand);
  assert.match(t, /^[0-9a-f]{32}$/);
  assert.match(s, /^[0-9a-f]{16}$/);
  const h = formatTraceparent(t, s, true);
  assert.equal(h, `00-${t}-${s}-01`);
  assert.deepEqual(parseTraceparent(h), { traceId: t, spanId: s, sampled: true });
  assert.equal(parseTraceparent(formatTraceparent(t, s, false))?.sampled, false);
  assert.equal(parseTraceparent(`00-${"0".repeat(32)}-${s}-01`), null);
  assert.equal(parseTraceparent(`ff-${t}-${s}-01`), null);
  assert.equal(parseTraceparent(`00-${t.toUpperCase()}-${s}-01`), null);
  assert.equal(parseTraceparent("garbage"), null);
  assert.equal(parseTraceparent(`00-${t}-${s}-01-extra`), null);
  // all-zero random output must never produce an invalid id
  assert.match(newTraceId(() => new Uint8Array(16)), /[1-9a-f]/);
});

test("sanitizeUrl strips query, hash and credentials", () => {
  assert.equal(sanitizeUrl("https://u:p@a.com/x/y?token=1#z", undefined), "https://a.com/x/y");
  assert.equal(sanitizeUrl("/api/items?id=5", "https://a.com/page"), "https://a.com/api/items");
  assert.equal(sanitizeUrl("https://a.com/x?a=1#h", undefined, true), "https://a.com/x?a=1");
  assert.equal(sanitizeUrl("::not a url?secret=1", undefined), "::not a url");
});

test("shouldPropagate: same-origin default, string prefix, regexp", () => {
  const base = "https://app.example.com/dash";
  assert.equal(shouldPropagate("/api/x", base), true);
  assert.equal(shouldPropagate("https://app.example.com/other", base), true);
  assert.equal(shouldPropagate("https://api.example.com/x", base), false);
  assert.equal(shouldPropagate("https://api.example.com/x", base, ["https://api.example.com"]), true);
  assert.equal(shouldPropagate("https://api.example.com.evil.io/x", base, ["https://api.example.com/"]), false);
  assert.equal(shouldPropagate("https://x.internal.io/a", base, [/^https:\/\/[a-z]+\.internal\.io\//]), true);
  assert.equal(shouldPropagate("https://x.internal.io/a", base, [/nomatch/g]), false);
});

test("SpanQueue drops oldest when full and respects byte caps", () => {
  const q = new SpanQueue(3);
  for (let i = 0; i < 5; i++) q.push({ json: String(i), bytes: 10 });
  assert.equal(q.size, 3);
  assert.equal(q.dropped, 2);
  assert.deepEqual(q.take(10, 25).map((x) => x.json), ["2", "3"]);
  q.push({ json: "big", bytes: 999 });
  assert.deepEqual(q.take(10, 100).map((x) => x.json), ["4"]);
  assert.equal(q.size, 0);
  assert.equal(q.dropped, 3);
});

test("CLS uses the largest session window and ignores input-driven shifts", () => {
  const c = new ClsTracker();
  c.add({ value: 0.05, startTime: 100 });
  c.add({ value: 0.05, startTime: 600 }); // same window: 0.10
  c.add({ value: 0.5, startTime: 700, hadRecentInput: true }); // ignored
  c.add({ value: 0.06, startTime: 5000 }); // new window (gap > 1s)
  assert.ok(Math.abs(c.value - 0.1) < 1e-9);
  // a window is capped at 5s even with steady shifts
  const d = new ClsTracker();
  for (let t = 0; t <= 6000; t += 500) d.add({ value: 0.01, startTime: t });
  assert.ok(d.value < 0.13 && d.value > 0.09, String(d.value));
});

test("INP: longest per interaction, p98-ish outlier skipping, none when no interactions", () => {
  const i = new InpTracker();
  assert.equal(i.value, undefined);
  i.add({ interactionId: 0, duration: 999 }); // hover-like: ignored
  assert.equal(i.value, undefined);
  i.add({ interactionId: 1, duration: 80 });
  i.add({ interactionId: 1, duration: 120 });
  i.add({ interactionId: 2, duration: 60 });
  assert.equal(i.value, 120);
  const big = new InpTracker();
  for (let n = 1; n <= 100; n++) big.add({ interactionId: n, duration: n });
  assert.equal(big.value, 98); // floor(100/50)=2 worst interactions skipped (100, 99)
});

test("rate thresholds", () => {
  assert.equal(rate("LCP", 2500), "good");
  assert.equal(rate("LCP", 3000), "needs-improvement");
  assert.equal(rate("CLS", 0.3), "poor");
  assert.equal(rate("INP", 200), "good");
});

test("OTLP JSON shape", () => {
  assert.equal(unixNano(1700000000123.456), "1700000000123456000");
  assert.deepEqual(encodeValue(3), { intValue: "3" });
  assert.deepEqual(encodeValue(0.5), { doubleValue: 0.5 });
  assert.deepEqual(encodeValue(true), { boolValue: true });
  assert.deepEqual(encodeValue("x"), { stringValue: "x" });

  const span: SpanData = {
    traceId: "a".repeat(32),
    spanId: "b".repeat(16),
    parentSpanId: "c".repeat(16),
    name: "exception",
    kind: 1,
    startMs: 1700000000000,
    endMs: 1700000000005,
    attributes: { s: "v", i: 7, d: 1.5, b: false, skip: undefined },
    events: [{ name: "exception", timeMs: 1700000000001, attributes: { "exception.type": "TypeError" } }],
    status: { code: 2, message: "boom" },
  };
  const body = JSON.parse(buildRequestBody({ "service.name": "web", "telemetry.sdk.language": "webjs" }, [JSON.stringify(encodeSpan(span))], "0.1.0"));
  const rs = body.resourceSpans[0];
  assert.deepEqual(rs.resource.attributes[0], { key: "service.name", value: { stringValue: "web" } });
  const sp = rs.scopeSpans[0].spans[0];
  assert.match(sp.traceId, /^[0-9a-f]{32}$/);
  assert.match(sp.spanId, /^[0-9a-f]{16}$/);
  assert.match(sp.parentSpanId, /^[0-9a-f]{16}$/);
  assert.match(sp.startTimeUnixNano, /^\d+$/);
  assert.match(sp.endTimeUnixNano, /^\d+$/);
  assert.equal(sp.kind, 1);
  assert.deepEqual(sp.status, { code: 2, message: "boom" });
  const keys = sp.attributes.map((a: any) => a.key);
  assert.deepEqual(keys, ["s", "i", "d", "b"]);
  for (const a of sp.attributes) {
    assert.equal(typeof a.key, "string");
    assert.deepEqual(Object.keys(a.value).length, 1);
    assert.ok(["stringValue", "intValue", "doubleValue", "boolValue"].includes(Object.keys(a.value)[0]));
  }
  assert.equal(sp.events[0].name, "exception");
  assert.match(sp.events[0].timeUnixNano, /^\d+$/);
});

test("exporter batches under the byte cap, sends auth header + keepalive, never rejects", async () => {
  const calls: any[] = [];
  const ex = createExporter({
    url: "https://i.example.com/v1/traces",
    projectKey: "owl_ing_k",
    resource: { "service.name": "w" },
    version: "0",
    maxBatchSpans: 1000,
    maxPayloadBytes: 3000,
    setTimeout: () => 0,
    clearTimeout: () => undefined,
    fetch: async (url, init) => {
      calls.push({ url, init });
      return {};
    },
  });
  for (let i = 0; i < 30; i++) ex.enqueue({ traceId: "a".repeat(32), spanId: "b".repeat(16), name: "n" + i, kind: 1, startMs: 1, endMs: 2, attributes: { pad: "x".repeat(200) } });
  await ex.flush();
  assert.ok(calls.length > 1, "split into several requests");
  let total = 0;
  for (const c of calls) {
    assert.equal(c.init.headers.authorization, "Bearer owl_ing_k");
    assert.equal(c.init.headers["content-type"], "application/json");
    assert.equal(c.init.keepalive, true);
    assert.ok(c.init.body.length <= 3000);
    total += JSON.parse(c.init.body).resourceSpans[0].scopeSpans[0].spans.length;
  }
  assert.equal(total, 30);

  const bad = createExporter({ url: "u", projectKey: "k", resource: {}, version: "0", setTimeout: () => 0, fetch: () => Promise.reject(new Error("net")) });
  bad.enqueue({ traceId: "a".repeat(32), spanId: "b".repeat(16), name: "n", kind: 1, startMs: 1, endMs: 2, attributes: {} });
  await bad.flush();
  const throwing = createExporter({ url: "u", projectKey: "k", resource: {}, version: "0", setTimeout: () => 0, fetch: () => { throw new Error("sync"); } });
  throwing.enqueue({ traceId: "a".repeat(32), spanId: "b".repeat(16), name: "n", kind: 1, startMs: 1, endMs: 2, attributes: {} });
  await throwing.flush();
});
