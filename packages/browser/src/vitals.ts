export type Rating = "good" | "needs-improvement" | "poor";

const THRESHOLDS: Record<string, [number, number]> = { LCP: [2500, 4000], CLS: [0.1, 0.25], INP: [200, 500] };

export function rate(name: "LCP" | "CLS" | "INP", value: number): Rating {
  const [good, poor] = THRESHOLDS[name];
  return value <= good ? "good" : value <= poor ? "needs-improvement" : "poor";
}

/**
 * CLS = largest "session window" of layout shifts: a window closes after a 1s gap
 * since the previous shift or when it reaches 5s. Shifts right after user input are ignored.
 */
export class ClsTracker {
  value = 0;
  private windowValue = 0;
  private windowStart = 0;
  private lastShift = 0;
  private open = false;

  add(shift: { value: number; startTime: number; hadRecentInput?: boolean }): void {
    if (shift.hadRecentInput) return;
    if (!this.open || shift.startTime - this.lastShift > 1000 || shift.startTime - this.windowStart > 5000) {
      this.open = true;
      this.windowValue = 0;
      this.windowStart = shift.startTime;
    }
    this.windowValue += shift.value;
    this.lastShift = shift.startTime;
    if (this.windowValue > this.value) this.value = this.windowValue;
  }
}

/**
 * INP: the worst interaction latency, ignoring one outlier per 50 interactions (approximates p98).
 * Events sharing an interactionId are one interaction; its latency is the longest event duration.
 */
export class InpTracker {
  private byId = new Map<number, number>();

  add(entry: { interactionId?: number; duration: number }): void {
    if (!entry.interactionId) return; // not a discrete interaction (e.g. hover)
    const prev = this.byId.get(entry.interactionId) ?? 0;
    if (entry.duration > prev) this.byId.set(entry.interactionId, entry.duration);
  }

  get count(): number {
    return this.byId.size;
  }

  /** Returns undefined when no interaction was observed. */
  get value(): number | undefined {
    const all = [...this.byId.values()].sort((a, b) => b - a);
    if (!all.length) return undefined;
    return all[Math.min(all.length - 1, Math.floor(all.length / 50))];
  }
}
