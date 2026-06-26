// Image URL optimization helpers.
//
// Supabase Storage supports on-the-fly image transformations via
// /storage/v1/render/image/public/{bucket}/{path}?width=&quality=&format=origin
// We rewrite any public-object URL we recognize into a render URL so the CDN
// returns a resized WebP/AVIF instead of the full original (often multi-MB).
//
// For non-Supabase URLs (Unsplash etc.) we add the provider's resize query
// when we know how, otherwise return the URL unchanged.

export type ImgOpts = {
  /** Target rendered width in CSS px (will be DPR-multiplied for srcSet). */
  w?: number;
  /** JPEG/WebP quality 1-100. Default 70. */
  q?: number;
};

const OBJECT_SEGMENT = "/storage/v1/object/public/";
const RENDER_SEGMENT = "/storage/v1/render/image/public/";

export function optimizeImg(src: string | null | undefined, opts: ImgOpts = {}): string {
  if (!src) return "";
  const { w, q = 70 } = opts;
  try {
    // Supabase storage public object → render endpoint
    if (src.includes(OBJECT_SEGMENT)) {
      const u = new URL(src);
      u.pathname = u.pathname.replace(OBJECT_SEGMENT, RENDER_SEGMENT);
      if (w) u.searchParams.set("width", String(w));
      u.searchParams.set("quality", String(q));
      // origin preserves source format; supabase will negotiate webp when supported
      if (!u.searchParams.has("format")) u.searchParams.set("format", "origin");
      return u.toString();
    }
    // Unsplash supports w & q params natively
    if (/images\.unsplash\.com/.test(src)) {
      const u = new URL(src);
      if (w) u.searchParams.set("w", String(w));
      u.searchParams.set("q", String(q));
      u.searchParams.set("auto", "format");
      return u.toString();
    }
  } catch {
    /* fall through */
  }
  return src;
}

/** Build a srcSet covering 1x/2x DPR for a target CSS width. */
export function srcSet(src: string | null | undefined, w: number, q = 70): string | undefined {
  if (!src) return undefined;
  const a = optimizeImg(src, { w, q });
  const b = optimizeImg(src, { w: w * 2, q });
  if (a === src && b === src) return undefined; // provider not recognized
  return `${a} 1x, ${b} 2x`;
}
