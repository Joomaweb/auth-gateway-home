const EMBED_VIDEO_RE = /youtube\.com|youtu\.be|vimeo\.com/i;

export function isEmbedVideoUrl(url: string | null | undefined): boolean {
  return !!url && EMBED_VIDEO_RE.test(url);
}

export function isDirectVideoUrl(url: string | null | undefined): boolean {
  return !!url && !isEmbedVideoUrl(url);
}

export function toEmbedUrl(url: string): string {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]+)/i);
  if (yt) {
    return `https://www.youtube.com/embed/${yt[1]}?autoplay=1&mute=1&loop=1&playlist=${yt[1]}&controls=0&modestbranding=1&playsinline=1&rel=0`;
  }
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?autoplay=1&muted=1&loop=1&background=1`;
  return url;
}

export function getMediaOrigin(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function getDnsPrefetchHref(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return `//${new URL(url).host}`;
  } catch {
    return null;
  }
}

export function getVideoMimeType(url: string): string | undefined {
  const pathname = (() => {
    try {
      return new URL(url).pathname.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  })();
  if (pathname.endsWith(".mp4")) return "video/mp4";
  if (pathname.endsWith(".webm")) return "video/webm";
  if (pathname.endsWith(".mov") || pathname.endsWith(".qt")) return "video/quicktime";
  return undefined;
}
