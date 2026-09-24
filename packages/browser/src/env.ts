/** Everything the SDK needs from the browser, injectable so it can be tested with fakes. */
export type Env = {
  /** Object whose `fetch` we patch (window). */
  global: Record<string, any>;
  fetch?: (...a: any[]) => Promise<any>;
  Headers?: any;
  Request?: any;
  XMLHttpRequest?: any;
  PerformanceObserver?: any;
  addEventListener?: (type: string, fn: (ev: any) => void, opts?: any) => void;
  location?: { href: string; origin?: string };
  document?: { visibilityState?: string; readyState?: string };
  navigator?: { userAgent?: string; language?: string; platform?: string; userAgentData?: { mobile?: boolean; platform?: string } };
  performance?: { timeOrigin?: number; now(): number; getEntriesByType?: (t: string) => any[] };
  storage?: { getItem(k: string): string | null; setItem(k: string, v: string): void };
  setTimeout?: (fn: () => void, ms: number) => unknown;
  clearTimeout?: (h: unknown) => void;
  now(): number;
  random(): number;
  randomBytes?: (n: number) => Uint8Array;
};

export function browserEnv(): Env {
  const g = globalThis as any;
  let storage: Env["storage"];
  try {
    storage = g.sessionStorage;
  } catch {
    storage = undefined;
  }
  return {
    global: g,
    fetch: typeof g.fetch === "function" ? g.fetch.bind(g) : undefined,
    Headers: g.Headers,
    Request: g.Request,
    XMLHttpRequest: g.XMLHttpRequest,
    PerformanceObserver: g.PerformanceObserver,
    addEventListener: typeof g.addEventListener === "function" ? g.addEventListener.bind(g) : undefined,
    location: g.location,
    document: g.document,
    navigator: g.navigator,
    performance: g.performance,
    storage,
    setTimeout: (fn, ms) => g.setTimeout(fn, ms),
    clearTimeout: (h) => g.clearTimeout(h),
    now: () => Date.now(),
    random: () => Math.random(),
  };
}
