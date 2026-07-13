import { invalidateRunCache } from "@/lib/api";

export type AppDataArea =
  | "all"
  | "products"
  | "categories"
  | "product_variants"
  | "store_settings"
  | "orders"
  | "order_items"
  | "profiles"
  | "messages"
  | "conversations";

export type AppDataChangeDetail = {
  area: AppDataArea | "storage";
  at: number;
};

const APP_DATA_CHANGED_EVENT = "app-data-changed";
const APP_DATA_CHANGED_KEY = "app:data-changed-at";
const LOCAL_CACHE_KEYS = ["home:v3", "shop:cats:v1"];
const LOCAL_CACHE_PREFIXES = ["shop:prods:v1:"];
const RUN_CACHE_PREFIXES = ["home:", "shop:", "product:", "store_settings:public", "admin:dashboard:"];

function hasLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function clearAppDataCaches() {
  RUN_CACHE_PREFIXES.forEach(invalidateRunCache);
  if (!hasLocalStorage()) return;

  try {
    LOCAL_CACHE_KEYS.forEach((key) => window.localStorage.removeItem(key));
    for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
      const key = window.localStorage.key(i);
      if (key && LOCAL_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore storage quota / private mode errors.
  }
}

export function signalAppDataChanged(area: AppDataArea = "all") {
  clearAppDataCaches();
  if (typeof window === "undefined") return;

  const detail: AppDataChangeDetail = { area, at: Date.now() };
  try {
    window.localStorage.setItem(APP_DATA_CHANGED_KEY, JSON.stringify(detail));
  } catch {
    // Ignore storage quota / private mode errors.
  }
  window.dispatchEvent(new CustomEvent<AppDataChangeDetail>(APP_DATA_CHANGED_EVENT, { detail }));
}

export function subscribeAppDataChanges(listener: (detail: AppDataChangeDetail) => void) {
  if (typeof window === "undefined") return () => {};

  const onCustom = (event: Event) => {
    listener((event as CustomEvent<AppDataChangeDetail>).detail ?? { area: "all", at: Date.now() });
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== APP_DATA_CHANGED_KEY) return;
    try {
      listener(event.newValue ? JSON.parse(event.newValue) as AppDataChangeDetail : { area: "storage", at: Date.now() });
    } catch {
      listener({ area: "storage", at: Date.now() });
    }
  };

  window.addEventListener(APP_DATA_CHANGED_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(APP_DATA_CHANGED_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}