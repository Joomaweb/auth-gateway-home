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
const VIDEO_EXT_RE = /\.(mp4|webm|mov|qt)(?:\?|#|$)/i;
const inFlight = new Set<string>();

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
 * Return a cached object-URL for `src` if present. On a miss, optionally warm
 * the cache in the background, but always return the network URL immediately.
 */
export async function getCachedMediaUrl(
  src: string,
  options: { fetchOnMiss?: boolean; includeVideos?: boolean } = {},
): Promise<string> {
  if (!src || !isBrowser()) return src;
  const cache = await openCache();
  if (!cache) return src;

  try {
    const hit = await cache.match(src);
    if (hit) {
      const blob = await hit.blob();
      return URL.createObjectURL(blob);
    }
    if (options.fetchOnMiss) warmMediaCache([src], { includeVideos: options.includeVideos });
    return src;
  } catch {
    return src;
  }
}

/** Warm the cache for a list of URLs without blocking. */
export function warmMediaCache(
  urls: (string | null | undefined)[],
  options: { includeVideos?: boolean } = {},
) {
  if (!isBrowser()) return;
  const list = urls.filter((u): u is string => {
    if (!u || !/^https?:/i.test(u)) return false;
    if (!options.includeVideos && VIDEO_EXT_RE.test(u)) return false;
    return true;
  });
  if (!list.length) return;
  void (async () => {
    const cache = await openCache();
    if (!cache) return;
    await Promise.allSettled(
      list.map(async (u) => {
        const hit = await cache.match(u);
        if (hit) return;
        if (inFlight.has(u)) return;
        inFlight.add(u);
        try {
          const res = await fetch(u, { mode: "cors", credentials: "omit" });
          if (res.ok) await cache.put(u, res.clone());
        } catch {
          /* ignore */
        } finally {
          inFlight.delete(u);
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
