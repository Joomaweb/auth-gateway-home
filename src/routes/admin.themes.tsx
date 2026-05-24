import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { THEMES, type ThemePreset, applyThemeVars, applyThemeFont, getTheme } from "@/lib/themes";
import { useActiveTheme } from "@/hooks/use-active-theme";
import { Button } from "@/components/ui/button";
import { Check, Palette } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/themes")({
  component: AdminThemes,
});

function ThemeSwatch({ vars, label }: { vars: Record<string, string>; label?: string }) {
  const keys = ["background", "foreground", "primary", "accent", "gold", "border"];
  return (
    <div className="flex items-center gap-1">
      {keys.map((k) => (
        <div key={k} className="h-6 w-6 rounded-full border" style={{ background: vars[k] }} title={k} />
      ))}
      {label && <span className="ms-2 text-xs text-muted-foreground">{label}</span>}
    </div>
  );
}

function ThemePreview({ t }: { t: ThemePreset }) {
  const v = t.vars;
  return (
    <div
      data-theme={t.id}
      className="rounded-lg border overflow-hidden"
      style={{ background: v.background, color: v.foreground, borderColor: v.border, borderRadius: v.radius }}
    >
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: v.sidebar, color: v["sidebar-foreground"], borderBottom: `1px solid ${v.border}` }}>
        <span className="font-semibold text-sm">{t.name}</span>
        <span className="text-xs opacity-70">Header</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="text-xl font-semibold" style={{ fontFamily: t.fontUrl?.includes("Playfair") ? "Playfair Display, serif" : t.fontUrl?.includes("Cormorant") ? "Cormorant Garamond, serif" : t.fontUrl?.includes("DM+Serif") ? "DM Serif Display, serif" : t.fontUrl?.includes("Space+Grotesk") ? "Space Grotesk, sans-serif" : "Inter, sans-serif" }}>
          Timeless wardrobe staples
        </div>
        <p className="text-sm opacity-75">דוגמה לטקסט בעיצוב הזה. כך ייראה התוכן באתר.</p>
        <div className="flex gap-2 flex-wrap">
          <span className="inline-flex items-center px-3 py-1.5 text-xs font-medium" style={{ background: v.primary, color: v["primary-foreground"], borderRadius: v.radius }}>Primary</span>
          <span className="inline-flex items-center px-3 py-1.5 text-xs font-medium" style={{ background: v.secondary, color: v["secondary-foreground"], borderRadius: v.radius }}>Secondary</span>
          <span className="inline-flex items-center px-3 py-1.5 text-xs font-medium" style={{ background: v.accent, color: v["accent-foreground"], borderRadius: v.radius }}>Accent</span>
          <span className="inline-flex items-center px-3 py-1.5 text-xs font-medium border" style={{ borderColor: v.border, borderRadius: v.radius, color: v.foreground }}>Outline</span>
        </div>
        <div className="rounded p-3" style={{ background: v.muted, color: v["muted-foreground"], borderRadius: v.radius }}>
          <div className="text-xs">Muted card · subtle background</div>
        </div>
      </div>
    </div>
  );
}

function AdminThemes() {
  const { themeId } = useActiveTheme();
  const [busy, setBusy] = useState<string | null>(null);

  const apply = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.from("store_settings").upsert({ id: 1, active_theme: id });
    setBusy(null);
    if (error) toast.error(error.message);
    else toast.success("העיצוב הוחל בזמן אמת בכל האתר");
  };

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <Palette className="h-6 w-6 text-primary" />
        <div>
          <h1 className="font-display text-3xl font-semibold">עיצובים</h1>
          <p className="text-sm text-muted-foreground">בחר עיצוב — השינוי מוחל מיידית בכל האתר ולכל המבקרים.</p>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {THEMES.map((t) => {
          const active = t.id === themeId;
          return (
            <div key={t.id} className={`rounded-xl border-2 p-4 space-y-4 transition ${active ? "border-primary shadow-elegant" : "border-border hover:border-primary/40"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{t.name}</h3>
                    {active && <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" /> פעיל</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                </div>
              </div>
              <ThemeSwatch vars={t.vars} />
              <ThemePreview t={t} />
              <Button
                onClick={() => apply(t.id)}
                disabled={active || busy === t.id}
                className="w-full"
                variant={active ? "outline" : "default"}
              >
                {active ? "מוחל כעת" : busy === t.id ? "מחיל…" : "החל עיצוב זה"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
