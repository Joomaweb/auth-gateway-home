import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";

export type Branding = {
  logo_url: string;
  favicon_url: string;
  site_name: string;
  logo_height?: number;
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string;
};
export type Legal = { terms_en: string; terms_he: string; policy_en: string; policy_he: string };

const DEFAULT_BRANDING: Branding = {
  logo_url: "",
  favicon_url: "",
  site_name: "",
  logo_height: 40,
  seo_title: "",
  seo_description: "",
  seo_keywords: "",
};
const DEFAULT_LEGAL: Legal = { terms_en: "", terms_he: "", policy_en: "", policy_he: "" };

type Ctx = { branding: Branding; legal: Legal; refresh: () => void };
const SiteCtx = createContext<Ctx>({ branding: DEFAULT_BRANDING, legal: DEFAULT_LEGAL, refresh: () => {} });

export function SiteBrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);
  const [legal, setLegal] = useState<Legal>(DEFAULT_LEGAL);
  const [nonce, setNonce] = useState(0);

  const refresh = () => setNonce((n) => n + 1);

  useEffect(() => {
    let active = true;
    supabase.from("store_settings").select("branding, legal").eq("id", 1).maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        if (data.branding) setBranding({ ...DEFAULT_BRANDING, ...(data.branding as Branding) });
        if (data.legal) setLegal({ ...DEFAULT_LEGAL, ...(data.legal as Legal) });
      });

    const ch = supabase
      .channel("store_settings_branding")
      .on("postgres_changes", { event: "*", schema: "public", table: "store_settings", filter: "id=eq.1" }, (payload) => {
        const row = (payload.new ?? {}) as { branding?: Branding; legal?: Legal };
        if (row.branding) setBranding({ ...DEFAULT_BRANDING, ...row.branding });
        if (row.legal) setLegal({ ...DEFAULT_LEGAL, ...row.legal });
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [nonce]);

  // Dynamic favicon
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (branding.favicon_url) {
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = branding.favicon_url;
    }
  }, [branding.favicon_url]);

  // Dynamic SEO meta tags from admin settings (title, description, keywords, og:*)
  useEffect(() => {
    if (typeof document === "undefined") return;

    const upsertMeta = (selector: string, attr: "name" | "property", key: string, value: string) => {
      let el = document.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", value);
    };

    const title = (branding.seo_title?.trim() || branding.site_name || "").trim();
    const desc = branding.seo_description?.trim() || "";
    const kw = branding.seo_keywords?.trim() || "";

    if (title) {
      document.title = title;
      upsertMeta('meta[property="og:title"]', "property", "og:title", title);
      upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", title);
    }
    if (desc) {
      upsertMeta('meta[name="description"]', "name", "description", desc);
      upsertMeta('meta[property="og:description"]', "property", "og:description", desc);
      upsertMeta('meta[name="twitter:description"]', "name", "twitter:description", desc);
    }
    if (kw) {
      upsertMeta('meta[name="keywords"]', "name", "keywords", kw);
    }
  }, [branding.site_name, branding.seo_title, branding.seo_description, branding.seo_keywords]);

  return <SiteCtx.Provider value={{ branding, legal, refresh }}>{children}</SiteCtx.Provider>;
}

export const useSiteBranding = () => useContext(SiteCtx);
