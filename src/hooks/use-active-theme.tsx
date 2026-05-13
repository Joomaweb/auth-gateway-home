import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { applyThemeFont, applyThemeVars, getTheme, THEMES, type ThemePreset } from "@/lib/themes";

type Ctx = { themeId: string; theme: ThemePreset; themes: ThemePreset[] };
const ThemeCtx = createContext<Ctx>({ themeId: "classic", theme: THEMES[0], themes: THEMES });

export function ActiveThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<string>("classic");

  useEffect(() => {
    let active = true;
    supabase.from("store_settings").select("active_theme").eq("id", 1).maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        if (data?.active_theme) setThemeId(data.active_theme);
      });

    const ch = supabase
      .channel("store_settings_theme")
      .on("postgres_changes", { event: "*", schema: "public", table: "store_settings", filter: "id=eq.1" }, (payload) => {
        const row = (payload.new ?? {}) as { active_theme?: string };
        if (row.active_theme) setThemeId(row.active_theme);
      })
      .subscribe();

    return () => { active = false; supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    const t = getTheme(themeId);
    applyThemeVars(t.vars);
    applyThemeFont(t.fontUrl);
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = t.id;
    }
  }, [themeId]);

  return <ThemeCtx.Provider value={{ themeId, theme: getTheme(themeId), themes: THEMES }}>{children}</ThemeCtx.Provider>;
}

export const useActiveTheme = () => useContext(ThemeCtx);
