// Frontend security helpers: input sanitization, image/video validation, password rules.

export const MAX_IMAGE_BYTES = 200 * 1024 * 1024; // 200 MB
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"] as const;
const ALLOWED_EXT = ["png", "jpg", "jpeg", "webp"] as const;
const ALLOWED_VIDEO_MIME = ["video/mp4", "video/webm", "video/quicktime"] as const;
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

export type ImageValidation =
  | { ok: true; ext: "png" | "jpg" | "webp" }
  | { ok: false; error: string };

export async function validateImageFile(file: File): Promise<ImageValidation> {
  if (!file) return { ok: false, error: "לא נבחר קובץ" };
  if (file.size === 0) return { ok: false, error: "קובץ ריק" };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "הקובץ גדול מ־200MB" };

  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED_EXT.includes(ext as (typeof ALLOWED_EXT)[number])) {
    return { ok: false, error: "סיומת לא נתמכת. רק PNG / JPG / WEBP" };
  }
  if (!ALLOWED_MIME.includes(file.type as (typeof ALLOWED_MIME)[number])) {
    return { ok: false, error: "סוג קובץ לא נתמך. רק PNG / JPG / WEBP" };
  }

  const sig = await readSignature(file);
  const png = isPng(sig);
  const jpg = isJpeg(sig);
  const webp = isWebp(sig);
  if (!png && !jpg && !webp) return { ok: false, error: "תוכן הקובץ אינו תמונה תקינה" };
  if (png && file.type !== "image/png") return { ok: false, error: "אי־התאמה בין תוכן הקובץ לסוגו" };
  if (jpg && file.type !== "image/jpeg") return { ok: false, error: "אי־התאמה בין תוכן הקובץ לסוגו" };
  if (webp && file.type !== "image/webp") return { ok: false, error: "אי־התאמה בין תוכן הקובץ לסוגו" };

  return { ok: true, ext: png ? "png" : webp ? "webp" : "jpg" };
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
    const isPngLike = file.type === "image/png";
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
  if (!file) return { ok: false, error: "לא נבחר קובץ" };
  if (file.size === 0) return { ok: false, error: "קובץ ריק" };
  if (file.size > MAX_VIDEO_BYTES) return { ok: false, error: "הסרטון גדול מ־50MB" };
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED_VIDEO_EXT.includes(ext as (typeof ALLOWED_VIDEO_EXT)[number])) {
    return { ok: false, error: "סיומת לא נתמכת. רק MP4 / WEBM / MOV" };
  }
  if (!ALLOWED_VIDEO_MIME.includes(file.type as (typeof ALLOWED_VIDEO_MIME)[number])) {
    return { ok: false, error: "סוג קובץ לא נתמך. רק MP4 / WEBM / MOV" };
  }
  return { ok: true, ext: ext === "mp4" ? "mp4" : ext === "webm" ? "webm" : "mov" };
}

// Strip HTML tags & control chars to prevent stored XSS in display fields.
export function sanitizeText(input: string, maxLen = 200): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maxLen);
}

export type PasswordCheck = { ok: boolean; error?: string };
export function checkPassword(pw: string): PasswordCheck {
  if (pw.length < 8) return { ok: false, error: "סיסמה חייבת להכיל לפחות 8 תווים" };
  if (pw.length > 128) return { ok: false, error: "סיסמה ארוכה מדי" };
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) {
    return { ok: false, error: "הסיסמה חייבת לכלול אותיות וספרות" };
  }
  return { ok: true };
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export const GENERIC_AUTH_ERROR = "פרטי ההתחברות שגויים";
export const GENERIC_SIGNUP_ERROR = "לא ניתן ליצור חשבון כעת. אנא נסה שוב";
