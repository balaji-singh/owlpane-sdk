export type QueueItem = { json: string; bytes: number };

/** Bounded FIFO. Oldest items are dropped when full so a broken endpoint cannot grow memory. */
export class SpanQueue {
  private items: QueueItem[] = [];
  dropped = 0;
  constructor(private readonly maxItems: number) {}

  get size(): number {
    return this.items.length;
  }

  push(item: QueueItem): void {
    this.items.push(item);
    while (this.items.length > this.maxItems) {
      this.items.shift();
      this.dropped++;
    }
  }

  /**
   * Removes and returns items for one request, capped by count and by total bytes.
   * A single oversize item is dropped (counted) rather than blocking the queue.
   */
  take(maxCount: number, maxBytes: number): QueueItem[] {
    const out: QueueItem[] = [];
    let bytes = 0;
    while (this.items.length && out.length < maxCount) {
      const next = this.items[0];
      if (next.bytes > maxBytes) {
        this.items.shift();
        this.dropped++;
        continue;
      }
      if (bytes + next.bytes > maxBytes) break;
      bytes += next.bytes;
      out.push(this.items.shift()!);
    }
    return out;
  }
}
