import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRealtime } from "@/hooks/use-realtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Plus, Trash2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { signalAppDataChanged } from "@/lib/realtime-sync";

export const Route = createFileRoute("/admin/about")({
  component: AdminAbout,
});

type Feature = { title: string; body: string };
type About = { title: string; body: string; features: Feature[] };

const DEFAULT_ABOUT: About = {
  title: "אודות ATELIER",
  body: "חנות בוטיק לאופנה קלאסית ועדינה — בדים יוקרתיים, גזרות נצחיות, יצירה אחראית.",
  features: [
    { title: "איכות", body: "בדים יוקרתיים ומלאכת יד מוקפדת." },
    { title: "קלאסי", body: "גזרות שלא יוצאות מהאופנה." },
    { title: "שקיפות", body: "מחירים הוגנים, בלי תוספות נסתרות." },
  ],
};

function mapErr(e: any): string {
  const m = e?.message || "";
  if (e?.code === "42501" || /row-level security|permission denied/i.test(m))
    return "אין הרשאה — ודא שאתה אדמין";
  return m || "שגיאה";
}

function AdminAbout() {
  const [a, setA] = useState<About>(DEFAULT_ABOUT);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("store_settings")
      .select("about")
      .eq("id", 1)
      .maybeSingle();
    if (data?.about) setA({ ...DEFAULT_ABOUT, ...(data.about as About) });
  };
  useEffect(() => {
    load();
  }, []);
  useRealtime("store_settings", load);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("store_settings").upsert({ id: 1, about: a });
    setBusy(false);
    if (error) return toast.error(mapErr(error));
    signalAppDataChanged("store_settings");
    toast.success("נשמר — האתר התעדכן בזמן אמת");
    setSavedAt(new Date().toLocaleTimeString("he-IL"));
  };

  const setFeature = (i: number, p: Partial<Feature>) =>
    setA({ ...a, features: a.features.map((f, j) => (i === j ? { ...f, ...p } : f)) });
  const addFeature = () => setA({ ...a, features: [...a.features, { title: "", body: "" }] });
  const delFeature = (i: number) =>
    setA({ ...a, features: a.features.filter((_, j) => j !== i) });

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-semibold">עמוד "אודות"</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            עריכה חיה — כל שינוי שתשמור מתעדכן מיידית בעמוד האתר.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          {savedAt ? `נשמר אחרון: ${savedAt}` : "מסונכרן בזמן אמת"}
        </span>
      </div>

      <Card className="shadow-elegant border-gold/30">
        <CardHeader className="bg-gradient-to-l from-muted/40 to-transparent">
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="h-8 w-8 rounded-md bg-gradient-gold text-gold-foreground flex items-center justify-center">
              <BookOpen className="h-4 w-4" />
            </span>
            תוכן ראשי
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>כותרת</Label>
            <Input
              value={a.title}
              onChange={(e) => setA({ ...a, title: e.target.value })}
              className="text-lg"
            />
          </div>
          <div className="space-y-1.5">
            <Label>טקסט</Label>
            <Textarea
              rows={6}
              value={a.body}
              onChange={(e) => setA({ ...a, body: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-lg">ערכים / תכונות</CardTitle>
          <Button size="sm" variant="outline" onClick={addFeature}>
            <Plus className="h-3.5 w-3.5 me-1.5" /> הוסף
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {a.features.map((f, i) => (
            <div key={i} className="grid gap-2 md:grid-cols-[1fr_2fr_auto] p-3 rounded-md border bg-muted/30">
              <Input
                placeholder="כותרת"
                value={f.title}
                onChange={(e) => setFeature(i, { title: e.target.value })}
              />
              <Textarea
                rows={2}
                placeholder="תיאור"
                value={f.body}
                onChange={(e) => setFeature(i, { body: e.target.value })}
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => delFeature(i)}
                className="text-destructive hover:bg-destructive/10 self-start"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {a.features.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-6">
              אין ערכים. הוסף לפחות אחד.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3 sticky bottom-4 bg-background/80 backdrop-blur p-3 rounded-md border shadow-elegant">
        <Button
          size="lg"
          onClick={save}
          disabled={busy}
          className="bg-gradient-gold text-gold-foreground hover:opacity-90 px-6"
        >
          <Save className="h-4 w-4 me-2" />
          {busy ? "שומר…" : "שמור ופרסם"}
        </Button>
      </div>
    </div>
  );
}
