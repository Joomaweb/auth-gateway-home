// Frontend security helpers: input sanitization, image/video validation, password rules.

export const MAX_IMAGE_BYTES = 30 * 1024 * 1024; // 30 MB
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"] as const;
const ALLOWED_EXT = ["png", "jpg", "jpeg", "webp"] as const;
const ALLOWED_VIDEO_MIME = ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v", "application/octet-stream"] as const;
const ALLOWED_VIDEO_EXT = ["mp4", "webm", "mov"] as const;

// Magic bytes for PNG / JPEG / WebP. Prevents fake-extension uploads.
async function readSignature(file: Blob, n = 16): Promise<Uint8Array> {
  const slice = file.slice(0, n);
  const buf = await slice.arrayBuffer();
  return new Uint8Array(buf);
}

function isPng(b: Uint8Array) {
  return (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  );
}
function isJpeg(b: Uint8Array) {
  return b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
}
function isWebp(b: Uint8Array) {
  return (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  );
}

function isIsoVideo(b: Uint8Array) {
  return b.length >= 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70;
}

function isWebm(b: Uint8Array) {
  return b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3;
}

export type ImageValidation =
  | { ok: true; ext: "png" | "jpg" | "webp" }
  | { ok: false; error: string };

export async function validateImageFile(file: File): Promise<ImageValidation> {
  if (!file) return { ok: false, error: "No file selected" };
  if (file.size === 0) return { ok: false, error: "Empty file" };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "File is larger than 30MB" };

  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const normExt = ext === "jpeg" ? "jpg" : ext;
  if (!ALLOWED_EXT.includes(ext as (typeof ALLOWED_EXT)[number])) {
    return { ok: false, error: "Unsupported extension. Only PNG / JPG / WEBP" };
  }
  // Some mobile browsers report empty or non-standard MIME (e.g. application/octet-stream, image/jpg).
  // Trust the file signature (magic bytes) as the source of truth.
  const sig = await readSignature(file);
  const png = isPng(sig);
  const jpg = isJpeg(sig);
  const webp = isWebp(sig);
  if (!png && !jpg && !webp) return { ok: false, error: "File content is not a valid image" };

  const detected: "png" | "jpg" | "webp" = png ? "png" : webp ? "webp" : "jpg";
  // If extension is provided, ensure it matches actual content.
  if (normExt !== detected) {
    return { ok: false, error: `File is actually ${detected.toUpperCase()}, rename it with .${detected} extension` };
  }
  return { ok: true, ext: detected };
}

// Client-side downscale to keep big phone photos under 2MB before upload.
// Returns a JPEG/WebP blob; preserves original if already small enough.
export async function downscaleImage(file: File, maxDim = 2200, targetBytes = 2 * 1024 * 1024): Promise<File> {
  if (file.size <= targetBytes) return file;
  if (typeof window === "undefined" || !("createImageBitmap" in window)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, w, h);
    const isPngLike = file.type === "image/png" || /\.png$/i.test(file.name);
    const mime = isPngLike ? "image/png" : "image/jpeg";
    const ext = isPngLike ? "png" : "jpg";
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, mime, 0.85));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + "." + ext, { type: mime });
  } catch {
    return file;
  }
}

export type VideoValidation =
  | { ok: true; ext: "mp4" | "webm" | "mov" }
  | { ok: false; error: string };

export async function validateVideoFile(file: File): Promise<VideoValidation> {
  if (!file) return { ok: false, error: "No file selected" };
  if (file.size === 0) return { ok: false, error: "Empty file" };
  if (file.size > MAX_VIDEO_BYTES) return { ok: false, error: "Video is larger than 200MB" };
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED_VIDEO_EXT.includes(ext as (typeof ALLOWED_VIDEO_EXT)[number])) {
    return { ok: false, error: "Unsupported extension. Only MP4 / WEBM / MOV" };
  }
  if (file.type && !ALLOWED_VIDEO_MIME.includes(file.type as (typeof ALLOWED_VIDEO_MIME)[number])) {
    return { ok: false, error: "Unsupported file type. Only MP4 / WEBM / MOV" };
  }
  const sig = await readSignature(file, 16);
  if (ext === "webm" && !isWebm(sig)) {
    return { ok: false, error: "File content is not a valid WEBM video" };
  }
  if ((ext === "mp4" || ext === "mov") && !isIsoVideo(sig)) {
    return { ok: false, error: "File content is not a valid MP4 / MOV video" };
  }
  return { ok: true, ext: ext === "mp4" ? "mp4" : ext === "webm" ? "webm" : "mov" };
}

// Strip HTML tags & control chars to prevent stored XSS in display fields.
export function sanitizeText(input: string, maxLen = 200): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/data:text\/html/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim()
    .slice(0, maxLen);
}

// Validate URLs — only allow http/https/relative paths. Blocks javascript:, data:, vbscript:.
export function sanitizeUrl(input: string, maxLen = 2048): string {
  const v = input.trim().slice(0, maxLen);
  if (!v) return "";
  // Allow relative paths
  if (v.startsWith("/") || v.startsWith("#") || v.startsWith("?")) return v;
  // Only http/https allowed for absolute URLs
  if (/^https?:\/\//i.test(v)) return v;
  return "";
}

export type PasswordCheck = { ok: boolean; error?: string };
export function checkPassword(pw: string): PasswordCheck {
  if (pw.length < 8) return { ok: false, error: "Password must be at least 8 characters" };
  if (pw.length > 128) return { ok: false, error: "Password is too long" };
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) {
    return { ok: false, error: "Password must contain letters and numbers" };
  }
  return { ok: true };
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export const GENERIC_AUTH_ERROR = "Invalid login credentials";
export const GENERIC_SIGNUP_ERROR = "Unable to create account right now. Please try again";
