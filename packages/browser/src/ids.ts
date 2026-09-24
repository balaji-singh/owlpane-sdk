/** Fills a Uint8Array with random bytes. Injected so tests are deterministic. */
export type RandomBytes = (n: number) => Uint8Array;

export function defaultRandomBytes(g: { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } } = globalThis as never): RandomBytes {
  return (n) => {
    const out = new Uint8Array(n);
    if (g.crypto?.getRandomValues) g.crypto.getRandomValues(out);
    else for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
    return out;
  };
}

function hex(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += (b < 16 ? "0" : "") + b.toString(16);
  return s;
}

/** Non-zero random hex id of `bytes` bytes (16 for trace ids, 8 for span ids). */
export function randomId(rand: RandomBytes, bytes: number): string {
  for (let i = 0; i < 4; i++) {
    const id = hex(rand(bytes));
    if (/[1-9a-f]/.test(id)) return id;
  }
  return "0".repeat(bytes * 2 - 1) + "1";
}

export const newTraceId = (rand: RandomBytes) => randomId(rand, 16);
export const newSpanId = (rand: RandomBytes) => randomId(rand, 8);

export function formatTraceparent(traceId: string, spanId: string, sampled: boolean): string {
  return `00-${traceId}-${spanId}-${sampled ? "01" : "00"}`;
}

export type Traceparent = { traceId: string; spanId: string; sampled: boolean };

/** Parses a W3C traceparent (version 00 layout; unknown future versions accepted per spec). */
export function parseTraceparent(value: string): Traceparent | null {
  const m = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})(-.*)?$/.exec(value.trim());
  if (!m) return null;
  const [, ver, traceId, spanId, flags, rest] = m;
  if (ver === "ff") return null;
  if (ver === "00" && rest) return null;
  if (/^0+$/.test(traceId) || /^0+$/.test(spanId)) return null;
  return { traceId, spanId, sampled: (parseInt(flags, 16) & 1) === 1 };
}
