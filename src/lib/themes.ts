// 5 ready-made theme presets. Each maps to CSS custom properties applied
// to :root at runtime via use-active-theme.tsx. Components consume semantic
// tokens (bg-primary, text-foreground, etc.) so changing these vars
// re-styles the entire site live, no reload required.

export type LayoutVariant =
  | "top-classic"
  | "top-split"
  | "top-stacked"
  | "side-left"
  | "floating-dock";

export type ThemePreset = {
  id: string;
  name: string;
  description: string;
  layout: LayoutVariant;
  fontUrl?: string;
  vars: Record<string, string>;
};

export const THEMES: ThemePreset[] = [
  {
    id: "classic",
    name: "Classic Atelier",
    description: "מינימליסטי שחור-לבן עם נגיעות זהב — העיצוב הנוכחי",
    layout: "top-classic",
    fontUrl: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&display=swap",
    vars: {
      radius: "0.5rem",
      background: "oklch(0.985 0.004 80)",
      foreground: "oklch(0.16 0.005 60)",
      card: "oklch(1 0 0)",
      "card-foreground": "oklch(0.16 0.005 60)",
      popover: "oklch(1 0 0)",
      "popover-foreground": "oklch(0.16 0.005 60)",
      primary: "oklch(0.18 0.005 60)",
      "primary-foreground": "oklch(0.985 0.004 80)",
      secondary: "oklch(0.94 0.012 80)",
      "secondary-foreground": "oklch(0.18 0.005 60)",
      muted: "oklch(0.95 0.008 80)",
      "muted-foreground": "oklch(0.48 0.01 70)",
      accent: "oklch(0.78 0.07 80)",
      "accent-foreground": "oklch(0.18 0.005 60)",
      gold: "oklch(0.74 0.09 78)",
      "gold-foreground": "oklch(0.18 0.005 60)",
      border: "oklch(0.9 0.012 80)",
      input: "oklch(0.93 0.01 80)",
      ring: "oklch(0.74 0.09 78)",
      sidebar: "oklch(0.97 0.008 80)",
      "sidebar-foreground": "oklch(0.18 0.005 60)",
      "sidebar-primary": "oklch(0.18 0.005 60)",
      "sidebar-primary-foreground": "oklch(0.985 0.004 80)",
      "sidebar-accent": "oklch(0.93 0.015 80)",
      "sidebar-accent-foreground": "oklch(0.18 0.005 60)",
      "sidebar-border": "oklch(0.9 0.012 80)",
      "sidebar-ring": "oklch(0.74 0.09 78)",
    },
  },
  {
    id: "luxury-gold",
    name: "Luxury Gold",
    description: "שחור עמוק + זהב מהודר, קלאס ויוקרה",
    layout: "top-split",
    fontUrl: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&display=swap",
    vars: {
      radius: "0.25rem",
      background: "oklch(0.12 0.005 60)",
      foreground: "oklch(0.96 0.02 80)",
      card: "oklch(0.16 0.008 60)",
      "card-foreground": "oklch(0.96 0.02 80)",
      popover: "oklch(0.16 0.008 60)",
      "popover-foreground": "oklch(0.96 0.02 80)",
      primary: "oklch(0.78 0.13 80)",
      "primary-foreground": "oklch(0.12 0.005 60)",
      secondary: "oklch(0.2 0.01 60)",
      "secondary-foreground": "oklch(0.96 0.02 80)",
      muted: "oklch(0.2 0.01 60)",
      "muted-foreground": "oklch(0.7 0.04 80)",
      accent: "oklch(0.78 0.13 80)",
      "accent-foreground": "oklch(0.12 0.005 60)",
      gold: "oklch(0.82 0.14 82)",
      "gold-foreground": "oklch(0.12 0.005 60)",
      border: "oklch(0.78 0.13 80 / 0.2)",
      input: "oklch(0.22 0.01 60)",
      ring: "oklch(0.82 0.14 82)",
      sidebar: "oklch(0.1 0.005 60)",
      "sidebar-foreground": "oklch(0.96 0.02 80)",
      "sidebar-primary": "oklch(0.82 0.14 82)",
      "sidebar-primary-foreground": "oklch(0.12 0.005 60)",
      "sidebar-accent": "oklch(0.18 0.008 60)",
      "sidebar-accent-foreground": "oklch(0.96 0.02 80)",
      "sidebar-border": "oklch(0.78 0.13 80 / 0.2)",
      "sidebar-ring": "oklch(0.82 0.14 82)",
    },
  },
  {
    id: "soft-pastel",
    name: "Soft Pastel",
    description: "ורוד עדין ובז׳ רך — נשי ומזמין",
    layout: "top-stacked",
    fontUrl: "https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Quicksand:wght@400;500;600&display=swap",
    vars: {
      radius: "1rem",
      background: "oklch(0.98 0.012 20)",
      foreground: "oklch(0.28 0.04 20)",
      card: "oklch(1 0 0)",
      "card-foreground": "oklch(0.28 0.04 20)",
      popover: "oklch(1 0 0)",
      "popover-foreground": "oklch(0.28 0.04 20)",
      primary: "oklch(0.72 0.13 15)",
      "primary-foreground": "oklch(0.99 0.01 20)",
      secondary: "oklch(0.94 0.025 30)",
      "secondary-foreground": "oklch(0.32 0.05 20)",
      muted: "oklch(0.95 0.018 30)",
      "muted-foreground": "oklch(0.52 0.04 20)",
      accent: "oklch(0.85 0.08 25)",
      "accent-foreground": "oklch(0.28 0.04 20)",
      gold: "oklch(0.78 0.1 60)",
      "gold-foreground": "oklch(0.28 0.04 20)",
      border: "oklch(0.9 0.02 20)",
      input: "oklch(0.94 0.018 25)",
      ring: "oklch(0.72 0.13 15)",
      sidebar: "oklch(0.96 0.018 25)",
      "sidebar-foreground": "oklch(0.28 0.04 20)",
      "sidebar-primary": "oklch(0.72 0.13 15)",
      "sidebar-primary-foreground": "oklch(0.99 0.01 20)",
      "sidebar-accent": "oklch(0.92 0.025 25)",
      "sidebar-accent-foreground": "oklch(0.28 0.04 20)",
      "sidebar-border": "oklch(0.9 0.02 20)",
      "sidebar-ring": "oklch(0.72 0.13 15)",
    },
  },
  {
    id: "bold-modern",
    name: "Bold Modern",
    description: "פוקסיה וציאן חיים — עכשווי ונועז",
    layout: "side-left",
    fontUrl: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap",
    vars: {
      radius: "0.75rem",
      background: "oklch(0.99 0 0)",
      foreground: "oklch(0.14 0.02 280)",
      card: "oklch(1 0 0)",
      "card-foreground": "oklch(0.14 0.02 280)",
      popover: "oklch(1 0 0)",
      "popover-foreground": "oklch(0.14 0.02 280)",
      primary: "oklch(0.58 0.27 330)",
      "primary-foreground": "oklch(0.99 0 0)",
      secondary: "oklch(0.95 0.03 220)",
      "secondary-foreground": "oklch(0.14 0.02 280)",
      muted: "oklch(0.96 0.01 280)",
      "muted-foreground": "oklch(0.45 0.04 280)",
      accent: "oklch(0.72 0.18 200)",
      "accent-foreground": "oklch(0.99 0 0)",
      gold: "oklch(0.72 0.18 200)",
      "gold-foreground": "oklch(0.14 0.02 280)",
      border: "oklch(0.9 0.02 280)",
      input: "oklch(0.93 0.015 280)",
      ring: "oklch(0.58 0.27 330)",
      sidebar: "oklch(0.14 0.02 280)",
      "sidebar-foreground": "oklch(0.99 0 0)",
      "sidebar-primary": "oklch(0.58 0.27 330)",
      "sidebar-primary-foreground": "oklch(0.99 0 0)",
      "sidebar-accent": "oklch(0.22 0.03 280)",
      "sidebar-accent-foreground": "oklch(0.99 0 0)",
      "sidebar-border": "oklch(0.25 0.03 280)",
      "sidebar-ring": "oklch(0.58 0.27 330)",
    },
  },
  {
    id: "dark-premium",
    name: "Dark Premium",
    description: "Dark mode קבוע עם neon accents וזכוכית",
    layout: "floating-dock",
    fontUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
    vars: {
      radius: "0.625rem",
      background: "oklch(0.15 0.01 250)",
      foreground: "oklch(0.97 0.005 250)",
      card: "oklch(0.2 0.012 250)",
      "card-foreground": "oklch(0.97 0.005 250)",
      popover: "oklch(0.2 0.012 250)",
      "popover-foreground": "oklch(0.97 0.005 250)",
      primary: "oklch(0.78 0.18 165)",
      "primary-foreground": "oklch(0.15 0.01 250)",
      secondary: "oklch(0.26 0.012 250)",
      "secondary-foreground": "oklch(0.97 0.005 250)",
      muted: "oklch(0.24 0.012 250)",
      "muted-foreground": "oklch(0.7 0.015 250)",
      accent: "oklch(0.7 0.2 295)",
      "accent-foreground": "oklch(0.15 0.01 250)",
      gold: "oklch(0.78 0.18 165)",
      "gold-foreground": "oklch(0.15 0.01 250)",
      border: "oklch(1 0 0 / 0.12)",
      input: "oklch(1 0 0 / 0.15)",
      ring: "oklch(0.78 0.18 165)",
      sidebar: "oklch(0.18 0.012 250)",
      "sidebar-foreground": "oklch(0.97 0.005 250)",
      "sidebar-primary": "oklch(0.78 0.18 165)",
      "sidebar-primary-foreground": "oklch(0.15 0.01 250)",
      "sidebar-accent": "oklch(0.26 0.012 250)",
      "sidebar-accent-foreground": "oklch(0.97 0.005 250)",
      "sidebar-border": "oklch(1 0 0 / 0.12)",
      "sidebar-ring": "oklch(0.78 0.18 165)",
    },
  },
];

export function getTheme(id: string | null | undefined): ThemePreset {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function applyThemeVars(vars: Record<string, string>) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  Object.entries(vars).forEach(([k, v]) => {
    root.style.setProperty(`--${k}`, v);
  });
}

export function applyThemeFont(fontUrl: string | undefined) {
  if (typeof document === "undefined") return;
  const id = "active-theme-font";
  let link = document.getElementById(id) as HTMLLinkElement | null;
  if (!fontUrl) {
    if (link) link.remove();
    return;
  }
  if (!link) {
    link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  if (link.href !== fontUrl) link.href = fontUrl;
}
