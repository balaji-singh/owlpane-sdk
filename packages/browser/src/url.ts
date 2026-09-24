/** Removes credentials, and query/hash unless `keepQuery`. Relative URLs resolve against `base`. */
export function sanitizeUrl(raw: string, base: string | undefined, keepQuery = false): string {
  try {
    const u = new URL(raw, base);
    u.username = "";
    u.password = "";
    if (!keepQuery) {
      u.search = "";
      u.hash = "";
    } else {
      u.hash = "";
    }
    return u.toString();
  } catch {
    return keepQuery ? raw.split("#")[0] : raw.split(/[?#]/)[0];
  }
}

export function urlPath(raw: string, base: string | undefined): string {
  try {
    return new URL(raw, base).pathname;
  } catch {
    return raw.split(/[?#]/)[0];
  }
}

export function urlOrigin(raw: string, base: string | undefined): string | null {
  try {
    const o = new URL(raw, base).origin;
    return o === "null" ? null : o;
  } catch {
    return null;
  }
}

export type AllowEntry = string | RegExp;

/**
 * Decides whether a request URL may receive a traceparent header.
 * Same-origin is always allowed. String entries match as a prefix of the absolute URL
 * (so "https://api.example.com" covers the whole origin); RegExp entries are tested against the absolute URL.
 */
export function shouldPropagate(raw: string, base: string | undefined, allow: readonly AllowEntry[] = []): boolean {
  let abs: string;
  try {
    abs = new URL(raw, base).toString();
  } catch {
    return false;
  }
  if (base) {
    const a = urlOrigin(abs, undefined);
    if (a && a === urlOrigin(base, undefined)) return true;
  }
  for (const e of allow) {
    if (typeof e === "string") {
      if (abs.startsWith(e)) return true;
    } else {
      e.lastIndex = 0;
      if (e.test(abs)) return true;
    }
  }
  return false;
}
