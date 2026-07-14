import { useEffect } from "react";
import {
  getDnsPrefetchHref,
  getMediaOrigin,
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

      // Do not add <link rel="preload" as="video">. Chromium mobile often
      // ignores that `as` value and it creates a second large request next to
      // the <video> element. The element itself streams the video immediately.
      void isDirectVideoUrl(cleanVideoUrl);
    }

    if (cleanPosterUrl) {
      add({ rel: "preload", href: cleanPosterUrl, as: "image", fetchPriority: "high" });
    }

    return () => {
      links.forEach((link) => link.remove());
    };
  }, [videoUrl, posterUrl]);
}
