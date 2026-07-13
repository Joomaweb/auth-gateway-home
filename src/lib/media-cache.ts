// Persistent media cache using the browser Cache Storage API.
//
// Strategy:
//  - First visit: fetch the asset from the cloud, stream it into a named Cache,
//    then serve subsequent hits from that Cache (0ms network cost, survives
//    browser restarts, works offline).
//  - Cache key is the source URL, so real-time updates in the admin panel
//    (which change the URL / query string) automatically bypass stale entries.
//  - We prune old entries in the same cache that no longer match any live URL
//    so we don't accumulate deleted videos forever.
//
// Only runs in the browser. Safe no-op during SSR.

const CACHE_NAME = "site-media-v1";
const MAX_BYTES = 300 * 1024 * 1024; // 300 MB total ceiling

function isBrowser() {
  return typeof window !== "undefined" && "caches" in window;
}

async function openCache(): Promise<Cache | null> {
  if (!isBrowser()) return null;
  try {
    return await caches.open(CACHE_NAME);
  } catch {
    return null;
  }
}

/**
 * Return a cached object-URL for `src` if present, else fetch, store, and return
 * an object-URL. Falls back to the original URL on any failure.
 */
export async function getCachedMediaUrl(src: string): Promise<string> {
  if (!src || !isBrowser()) return src;
  const cache = await openCache();
  if (!cache) return src;

  try {
    const hit = await cache.match(src);
    if (hit) {
      const blob = await hit.blob();
      return URL.createObjectURL(blob);
    }
    // Fetch + cache in the background; return the network URL immediately so
    // the browser can start streaming without waiting for the full download.
    void (async () => {
      try {
        const res = await fetch(src, { mode: "cors", credentials: "omit" });
        if (!res.ok) return;
        await cache.put(src, res.clone());
        await enforceQuota(cache);
      } catch {
        /* ignore */
      }
    })();
    return src;
  } catch {
    return src;
  }
}

/** Warm the cache for a list of URLs without blocking. */
export function warmMediaCache(urls: (string | null | undefined)[]) {
  if (!isBrowser()) return;
  const list = urls.filter((u): u is string => !!u && /^https?:/i.test(u));
  if (!list.length) return;
  void (async () => {
    const cache = await openCache();
    if (!cache) return;
    await Promise.allSettled(
      list.map(async (u) => {
        const hit = await cache.match(u);
        if (hit) return;
        try {
          const res = await fetch(u, { mode: "cors", credentials: "omit" });
          if (res.ok) await cache.put(u, res.clone());
        } catch {
          /* ignore */
        }
      }),
    );
    await enforceQuota(cache);
  })();
}

/** Remove entries not in `keepUrls`. Call when new settings arrive. */
export async function pruneMediaCache(keepUrls: (string | null | undefined)[]) {
  const cache = await openCache();
  if (!cache) return;
  const keep = new Set(keepUrls.filter(Boolean) as string[]);
  const keys = await cache.keys();
  await Promise.allSettled(
    keys.filter((req) => !keep.has(req.url)).map((req) => cache.delete(req)),
  );
}

async function enforceQuota(cache: Cache) {
  try {
    const keys = await cache.keys();
    let total = 0;
    const sizes: { req: Request; size: number }[] = [];
    for (const req of keys) {
      const res = await cache.match(req);
      if (!res) continue;
      const len = Number(res.headers.get("content-length") || 0);
      sizes.push({ req, size: len });
      total += len;
    }
    if (total <= MAX_BYTES) return;
    // Evict oldest-first (Cache Storage keeps insertion order).
    for (const { req } of sizes) {
      if (total <= MAX_BYTES) break;
      const res = await cache.match(req);
      const len = Number(res?.headers.get("content-length") || 0);
      await cache.delete(req);
      total -= len;
    }
  } catch {
    /* ignore */
  }
}
