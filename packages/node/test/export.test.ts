import assert from "node:assert/strict";
import http from "node:http";
import { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";

describe("@owlpane/node exports telemetry", () => {
  const received: Array<{ url: string; auth: string | undefined; bytes: number }> = [];
  let collector: http.Server;
  before(async () => {
    collector = http.createServer((req, res) => {
      let bytes = 0;
      req.on("data", (c) => (bytes += c.length));
      req.on("end", () => {
        received.push({ url: req.url ?? "", auth: req.headers.authorization, bytes });
        res.writeHead(200, { "content-type": "application/json" }).end("{}");
      });
    });
    await new Promise<void>((r) => collector.listen(0, "127.0.0.1", r));
  });
  after(() => collector.close());

  it("sends traces with the project key as a bearer credential", async () => {
    const port = (collector.address() as AddressInfo).port;
    const owl = await import("../src/index");
    const key = `owl_ing_${"a".repeat(48)}`;
    owl.start({ service: "sdk-test", ingestKey: key, endpoint: `http://127.0.0.1:${port}` } as never);
    assert.equal(owl.isEnabled(), true);
    const app = http.createServer((_q, r) => r.end("ok"));
    await new Promise<void>((r) => app.listen(0, "127.0.0.1", r));
    await fetch(`http://127.0.0.1:${(app.address() as AddressInfo).port}/hello`);
    app.close();
    await owl.shutdown();
    const trace = received.find((r) => r.url.endsWith("/v1/traces"));
    assert.ok(trace, `no trace export, saw ${JSON.stringify(received)}`);
    assert.equal(trace.auth, `Bearer ${key}`);
    assert.ok(trace.bytes > 0);
    const metrics = received.filter((r) => r.url.endsWith("/v1/metrics"));
    assert.ok(metrics.length > 0, "metrics are exported on shutdown");
    for (const m of metrics) assert.equal(m.auth, `Bearer ${key}`, "metrics carry the project key too, or the gateway would refuse them");
  });
});
