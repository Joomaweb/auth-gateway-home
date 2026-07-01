import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { applyThemeFont, applyThemeVars, getTheme, THEMES, type ThemePreset } from "@/lib/themes";
import { getPublicStoreSettings, subscribePublicStoreSettings } from "@/lib/store-settings";

type Ctx = { themeId: string; theme: ThemePreset; themes: ThemePreset[] };
const ThemeCtx = createContext<Ctx>({ themeId: "classic", theme: THEMES[0], themes: THEMES });

export function ActiveThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<string>("classic");

  useEffect(() => {
    let active = true;
    getPublicStoreSettings()
      .then((data) => {
        if (!active) return;
        if (data?.active_theme) setThemeId(data.active_theme);
      })
      .catch(() => {});

    const unsubscribe = subscribePublicStoreSettings((row) => {
      if (row.active_theme) setThemeId(row.active_theme);
    });

    return () => { active = false; unsubscribe(); };
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
