// Frontend security helpers: input sanitization, image validation, password rules.

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = ["image/png", "image/jpeg"] as const;
const ALLOWED_EXT = ["png", "jpg", "jpeg"] as const;

// Magic bytes for PNG / JPEG. Prevents fake-extension uploads.
async function readSignature(file: File): Promise<Uint8Array> {
  const slice = file.slice(0, 12);
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

export type ImageValidation =
  | { ok: true; ext: "png" | "jpg" }
  | { ok: false; error: string };

export async function validateImageFile(file: File): Promise<ImageValidation> {
  if (!file) return { ok: false, error: "לא נבחר קובץ" };
  if (file.size === 0) return { ok: false, error: "קובץ ריק" };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "הקובץ גדול מ־5MB" };

  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED_EXT.includes(ext as (typeof ALLOWED_EXT)[number])) {
    return { ok: false, error: "סיומת קובץ לא נתמכת. רק PNG / JPG / JPEG" };
  }
  if (!ALLOWED_MIME.includes(file.type as (typeof ALLOWED_MIME)[number])) {
    return { ok: false, error: "סוג קובץ לא נתמך. רק PNG / JPG / JPEG" };
  }

  const sig = await readSignature(file);
  const png = isPng(sig);
  const jpg = isJpeg(sig);
  if (!png && !jpg) return { ok: false, error: "תוכן הקובץ אינו תמונה תקינה" };
  // Cross-check: extension/mime must match real signature
  if (png && file.type !== "image/png") return { ok: false, error: "אי־התאמה בין תוכן הקובץ לסוגו" };
  if (jpg && file.type !== "image/jpeg") return { ok: false, error: "אי־התאמה בין תוכן הקובץ לסוגו" };

  return { ok: true, ext: png ? "png" : "jpg" };
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
  // Basic but strict-enough check; server is source of truth.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

// Generic auth error to avoid account enumeration.
export const GENERIC_AUTH_ERROR = "פרטי ההתחברות שגויים";
export const GENERIC_SIGNUP_ERROR = "לא ניתן ליצור חשבון כעת. אנא נסה שוב";
