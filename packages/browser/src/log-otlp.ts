import { Attrs, encodeAttrs, unixNano } from "./otlp.js";

const REPLAY_SCOPE = { name: "@owlpane/browser-replay", version: "0.1.3" };

export function buildLogsRequestBody(
  resourceAttrs: Attrs,
  records: Array<{ timeMs: number; body: string; attributes: Attrs }>,
): string {
  const resource = JSON.stringify({ attributes: encodeAttrs(resourceAttrs) });
  const logs = records.map((r) =>
    JSON.stringify({
      timeUnixNano: unixNano(r.timeMs),
      body: { stringValue: r.body },
      attributes: encodeAttrs(r.attributes),
    }),
  );
  return `{"resourceLogs":[{"resource":${resource},"scopeLogs":[{"scope":${JSON.stringify(REPLAY_SCOPE)},"logRecords":[${logs.join(",")}]}]}]}`;
}

export type LogFetchLike = (input: string, init: {
  method: string;
  headers: Record<string, string>;
  body: string;
  keepalive: boolean;
}) => Promise<{ ok: boolean }>;

/** POST OTLP/HTTP JSON logs. Never throws. */
export async function postLogs(
  url: string,
  projectKey: string,
  body: string,
  fetchFn: LogFetchLike | undefined,
): Promise<void> {
  if (!fetchFn) return;
  try {
    await fetchFn(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${projectKey}` },
      body,
      keepalive: true,
    });
  } catch {
    /* ignore */
  }
}
