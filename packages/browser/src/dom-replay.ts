import { buildLogsRequestBody, postLogs, type LogFetchLike } from "./log-otlp.js";
import type { Attrs } from "./otlp.js";

type RrwebEvent = { timestamp: number; type: number };

export type DomReplayOptions = {
  logsUrl: string;
  projectKey: string;
  sessionId: string;
  resource: Attrs;
  fetch: LogFetchLike | undefined;
  /** Max rrweb events buffered before flush (default 8). */
  batchSize?: number;
};

/** Starts rrweb recording and ships events as OTLP logs. Returns stop handle. */
export function startDomReplay(opts: DomReplayOptions): () => void {
  let seq = 0;
  let buffer: RrwebEvent[] = [];
  let stopRecord: (() => void) | undefined;

  const flush = async () => {
    if (!buffer.length) return;
    const batch = buffer;
    buffer = [];
    const records = batch.map((ev) => ({
      timeMs: ev.timestamp,
      body: JSON.stringify(ev),
      attributes: {
        "owlpane.replay.kind": "rrweb",
        "owlpane.replay.session_id": opts.sessionId,
        "owlpane.replay.seq": seq++,
      },
    }));
    const body = buildLogsRequestBody(opts.resource, records);
    await postLogs(opts.logsUrl, opts.projectKey, body, opts.fetch);
  };

  void import("rrweb").then(({ record }) => {
    stopRecord = record({
      emit(event) {
        buffer.push(event);
        if (buffer.length >= (opts.batchSize ?? 8)) void flush();
      },
      maskAllInputs: true,
      blockClass: "owlpane-replay-block",
    });
  });

  return () => {
    stopRecord?.();
    void flush();
  };
}
