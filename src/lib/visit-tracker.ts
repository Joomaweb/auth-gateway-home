import { supabase } from "@/lib/supabase";

const VISITOR_KEY = "visitor_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 2; // 2 years

let cachedIp: string | null = null;
const recentPaths = new Map<string, number>();
const DEDUPE_MS = 30 * 60 * 1000; // same path from same tab within 30min = 1 visit

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string) {
  try {
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  } catch {
    // ignore
  }
}

/** Stable per-device identifier, persisted in both a cookie and localStorage. */
export function getVisitorId(): string {
  if (typeof window === "undefined") return "";
  let id = readCookie(VISITOR_KEY);
  if (!id) {
    try {
      id = window.localStorage.getItem(VISITOR_KEY);
    } catch {
      id = null;
    }
  }
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
  writeCookie(VISITOR_KEY, id);
  try {
    window.localStorage.setItem(VISITOR_KEY, id);
  } catch {
    // ignore
  }
  return id;
}

async function getIp(): Promise<string> {
  if (cachedIp !== null) return cachedIp;
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const data = (await res.json()) as { ip?: string };
    cachedIp = data.ip ?? "";
  } catch {
    cachedIp = "";
  }
  return cachedIp;
}

export async function trackVisit(path: string) {
  if (typeof window === "undefined") return;

  const now = Date.now();
  const last = recentPaths.get(path);
  if (last && now - last < DEDUPE_MS) return;
  recentPaths.set(path, now);

  try {
    const visitorId = getVisitorId();
    const { data: sess } = await supabase.auth.getSession();
    const ip = await getIp();
    await supabase.from("site_visits").insert({
      user_id: sess.session?.user?.id ?? null,
      visitor_id: visitorId || null,
      ip: ip || null,
      path,
      user_agent: navigator.userAgent.slice(0, 300),
    });
  } catch {
    // ignore
  }
}
