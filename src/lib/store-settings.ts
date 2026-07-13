import { supabase } from "@/lib/supabase";
import { invalidateRunCache, run } from "@/lib/api";
import { subscribeAppDataChanges } from "@/lib/realtime-sync";

export type PublicStoreSettings = {
  branding?: unknown;
  legal?: unknown;
  active_theme?: string;
  hero?: unknown;
  hero_video?: string;
  carousel_images?: unknown;
  show_featured?: boolean;
  show_sale?: boolean;
};

const SETTINGS_KEY = "store_settings:public";
const SETTINGS_SELECT = "branding,legal,active_theme,hero,hero_video,carousel_images,show_featured,show_sale";

export async function getPublicStoreSettings(): Promise<PublicStoreSettings> {
  const { data, error } = await run(
    { key: SETTINGS_KEY, timeoutMs: 5000, attempts: 2, cacheMs: 60_000 },
    () => supabase.from("store_settings").select(SETTINGS_SELECT).eq("id", 1).maybeSingle(),
  );
  if (error) throw error;
  return (data ?? {}) as PublicStoreSettings;
}

type Listener = (settings: PublicStoreSettings) => void;

const listeners = new Set<Listener>();
let channel: ReturnType<typeof supabase.channel> | null = null;
let unsubscribeSignals: (() => void) | null = null;

export function subscribePublicStoreSettings(listener: Listener) {
  listeners.add(listener);
  if (!channel) {
    channel = supabase
      .channel("store_settings_public")
      .on("postgres_changes", { event: "*", schema: "public", table: "store_settings", filter: "id=eq.1" }, (payload) => {
        invalidateRunCache(SETTINGS_KEY);
        const row = (payload.new ?? {}) as PublicStoreSettings;
        listeners.forEach((fn) => fn(row));
      })
      .subscribe();
    unsubscribeSignals = subscribeAppDataChanges((detail) => {
      if (detail.area !== "all" && detail.area !== "store_settings" && detail.area !== "storage") return;
      invalidateRunCache(SETTINGS_KEY);
      getPublicStoreSettings()
        .then((settings) => listeners.forEach((fn) => fn(settings)))
        .catch(() => {});
    });
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && channel) {
      supabase.removeChannel(channel);
      channel = null;
      unsubscribeSignals?.();
      unsubscribeSignals = null;
    }
  };
}

export function invalidatePublicStoreSettings() {
  invalidateRunCache(SETTINGS_KEY);
}