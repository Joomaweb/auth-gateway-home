import { useEffect, useState } from "react";
import { getCachedMediaUrl } from "@/lib/media-cache";

/**
 * Returns a persistent locally-cached URL for `src` when available, else `src`.
 * On first call the original cloud URL is returned immediately (no delay);
 * behind the scenes the file is downloaded into Cache Storage so the next
 * visit is instant.
 */
export function useCachedMedia(
  src: string | null | undefined,
  options: { fetchOnMiss?: boolean; includeVideos?: boolean } = { fetchOnMiss: true },
): string {
  const [url, setUrl] = useState<string>(src ?? "");
  useEffect(() => {
    let alive = true;
    let created: string | null = null;
    setUrl(src ?? "");
    if (!src) return;
    getCachedMediaUrl(src, options).then((resolved) => {
      if (!alive) return;
      if (resolved !== src && resolved.startsWith("blob:")) created = resolved;
      setUrl(resolved);
    });
    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [src, options.fetchOnMiss, options.includeVideos]);
  return url;
}
