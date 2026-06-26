// Tiny resilience layer for Supabase / fetch calls.
//
// Provides:
//   • dedupe()         — coalesce concurrent identical requests by key
//   • withTimeout()    — abort a slow request after N ms
//   • retry()          — exponential backoff with jitter on transient errors
//   • run()            — convenience: dedupe + timeout + retry around a builder
//
// Designed to wrap supabase-js calls. supabase-js queries are PromiseLike but
// also expose `.abortSignal(signal)` — we use it when present so the network
// request actually cancels rather than just being ignored.

type Builder<T> = (signal: AbortSignal) => PromiseLike<T> & {
  abortSignal?: (s: AbortSignal) => unknown;
};

const inflight = new Map<string, Promise<unknown>>();

/** Coalesce concurrent calls sharing the same key into one network request. */
export function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = inflight.get(key) as Promise<T> | undefined;
  if (hit) return hit;
  const p = fn().finally(() => {
    // Keep the entry only while in-flight; subsequent calls run fresh.
    if (inflight.get(key) === p) inflight.delete(key);
  });
  inflight.set(key, p);
  return p;
}

/** Wrap a builder with an AbortController that fires after `ms`. */
export function withTimeout<T>(ms: number, build: Builder<T>): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error(`timeout ${ms}ms`)), ms);
  const q = build(ctrl.signal);
  // supabase-js: attach signal so the underlying fetch is cancelable.
  if (typeof q.abortSignal === "function") q.abortSignal(ctrl.signal);
  return Promise.resolve(q).finally(() => clearTimeout(timer)) as Promise<T>;
}

const TRANSIENT = /timeout|network|fetch|abort|503|502|504|ECONNRESET|ETIMEDOUT/i;

function isTransient(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return TRANSIENT.test(msg);
}

/** Exponential backoff with jitter. attempts=3 → ~300ms, 800ms, 2000ms. */
export async function retry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i === attempts - 1 || !isTransient(e)) break;
      const base = 200 * Math.pow(2.2, i);
      const jitter = Math.random() * 150;
      await new Promise((r) => setTimeout(r, base + jitter));
    }
  }
  throw lastErr;
}

export type RunOpts = {
  /** Cache key for in-flight dedupe. Same key = single shared request. */
  key: string;
  /** Per-attempt timeout. Default 8000ms. */
  timeoutMs?: number;
  /** Retry count incl. first attempt. Default 3. */
  attempts?: number;
};

/** dedupe + timeout + retry. Use for any Supabase/HTTP read where lag matters. */
export function run<T>(opts: RunOpts, build: Builder<T>): Promise<T> {
  const { key, timeoutMs = 8000, attempts = 3 } = opts;
  return dedupe(key, () => retry(() => withTimeout(timeoutMs, build), attempts));
}
