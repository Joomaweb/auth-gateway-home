import { supabase } from "@/lib/supabase";

let cachedIp: string | null = null;
const seenPaths = new Set<string>();

async function getIp(): Promise<string | null> {
  if (cachedIp !== null) return cachedIp;
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const data = (await res.json()) as { ip?: string };
    cachedIp = data.ip ?? "";
    return cachedIp;
  } catch {
    cachedIp = "";
    return "";
  }
}

export async function trackVisit(path: string) {
  if (typeof window === "undefined") return;
  // dedupe per session+path
  const key = path;
  if (seenPaths.has(key)) return;
  seenPaths.add(key);
  try {
    const { data: sess } = await supabase.auth.getSession();
    const ip = await getIp();
    await supabase.from("site_visits").insert({
      user_id: sess.session?.user?.id ?? null,
      ip: ip || null,
      path,
      user_agent: navigator.userAgent.slice(0, 300),
    });
  } catch {
    // ignore
  }
}
