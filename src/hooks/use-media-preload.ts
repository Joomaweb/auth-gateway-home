import { useEffect } from "react";
import {
  getDnsPrefetchHref,
  getMediaOrigin,
  getVideoMimeType,
  isDirectVideoUrl,
} from "@/lib/media";

type PreloadLinkOptions = {
  rel: string;
  href: string;
  as?: string;
  type?: string;
  fetchPriority?: "high" | "low" | "auto";
};

function appendLink(options: PreloadLinkOptions): HTMLLinkElement | null {
  const existing = document.head.querySelector<HTMLLinkElement>(
    `link[rel="${options.rel}"][href="${options.href}"]`,
  );
  if (existing) return null;

  const link = document.createElement("link");
  link.rel = options.rel;
  link.href = options.href;
  if (options.as) link.as = options.as;
  if (options.type) link.type = options.type;
  if (options.fetchPriority) link.setAttribute("fetchpriority", options.fetchPriority);
  document.head.appendChild(link);
  return link;
}

export function useMediaPreload(videoUrl?: string, posterUrl?: string) {
  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const links: HTMLLinkElement[] = [];
    const add = (options: PreloadLinkOptions) => {
      const link = appendLink(options);
      if (link) links.push(link);
    };

    const cleanVideoUrl = videoUrl?.trim();
    const cleanPosterUrl = posterUrl?.trim();

    if (cleanVideoUrl) {
      const origin = getMediaOrigin(cleanVideoUrl);
      const dns = getDnsPrefetchHref(cleanVideoUrl);
      if (origin) add({ rel: "preconnect", href: origin });
      if (dns) add({ rel: "dns-prefetch", href: dns });

      if (isDirectVideoUrl(cleanVideoUrl)) {
        add({
          rel: "preload",
          href: cleanVideoUrl,
          as: "video",
          type: getVideoMimeType(cleanVideoUrl),
          fetchPriority: "high",
        });
      }
    }

    if (cleanPosterUrl) {
      add({ rel: "preload", href: cleanPosterUrl, as: "image", fetchPriority: "high" });
    }

    return () => {
      links.forEach((link) => link.remove());
    };
  }, [videoUrl, posterUrl]);
}