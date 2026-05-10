import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Upload, Save, X, Tag } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/categories")({
  component: AdminCategories,
});

type Category = { id: string; name: string; slug: string; image_url: string | null };

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9\u0590-\u05FF]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

function mapErr(e: any): string {
  const m = e?.message || "";
  if (e?.code === "42501" || /row-level security|permission denied/i.test(m))
    return "אין הרשאה — ודא שאתה אדמין (user_roles)";
  if (e?.code === "23505" || /duplicate|unique/i.test(m)) return "כבר קיימת קטגוריה עם slug זהה";
  return m || "שגיאה לא ידועה";
}

function AdminCategories() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ name: string; slug: string; image_url: string }>({
    name: "",
    slug: "",
    image_url: "",
  });

  const load = async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("id,name,slug,image_url")
      .order("name");
    if (error) toast.error(mapErr(error));
    setRows((data ?? []) as Category[]);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);
  useRealtime("categories", load);

  const upload = async (file: File, onDone: (url: string) => void) => {
    if (!user) return toast.error("יש להתחבר");
    const { validateImageFile } = await import("@/lib/security");
    const v = await validateImageFile(file);
    if (!v.ok) return toast.error(v.error);
    const path = `categories/${user.id}/${Date.now()}-${crypto.randomUUID()}.${v.ext}`;
    const { error } = await supabase.storage.from("upload").upload(path, file, {
      contentType: file.type,
      upsert: false,
      cacheControl: "3600",
    });
    if (error) return toast.error("העלאה נכשלה: " + error.message);
    const { data } = supabase.storage.from("upload").getPublicUrl(path);
    onDone(data.publicUrl);
    toast.success("התמונה הועלתה");
  };

  const add = async () => {
    const name = draft.name.trim();
    if (!name) return toast.error("הקלד שם קטגוריה");
    const slug = (draft.slug || slugify(name)) || slugify(name);
    setBusy("new");
    const { error } = await supabase
      .from("categories")
      .insert({ name, slug, image_url: draft.image_url || null });
    setBusy(null);
    if (error) return toast.error(mapErr(error));
    toast.success("הקטגוריה נוספה");
    setDraft({ name: "", slug: "", image_url: "" });
  };

  const update = async (c: Category, patch: Partial<Category>) => {
    setBusy(c.id);
    const { error } = await supabase
      .from("categories")
      .update(patch)
      .eq("id", c.id)
      .select("id")
      .single();
    setBusy(null);
    if (error) return toast.error(mapErr(error));
    toast.success("נשמר");
  };

  const remove = async (c: Category) => {
    if (!confirm(`למחוק את "${c.name}"?`)) return;
    setBusy(c.id);
    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    setBusy(null);
    if (error) return toast.error(mapErr(error));
    toast.success("נמחק");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-semibold">קטגוריות</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            הוספה, עריכה ומחיקה — מתעדכן בזמן אמת באתר ובאפליקציה.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          סנכרון בזמן אמת פעיל
        </span>
      </div>

      <Card className="shadow-elegant border-gold/30">
        <CardHeader className="bg-gradient-to-l from-muted/40 to-transparent">
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="h-8 w-8 rounded-md bg-gradient-gold text-gold-foreground flex items-center justify-center">
              <Plus className="h-4 w-4" />
            </span>
            הוספת קטגוריה חדשה
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-[120px_1fr_1fr_auto] items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">תמונה</Label>
              <label className="block w-full aspect-square rounded-md border-2 border-dashed bg-muted/40 hover:bg-muted/70 cursor-pointer overflow-hidden relative">
                {draft.image_url ? (
                  <img src={draft.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs">
                    <Upload className="h-4 w-4 mb-1" />
                    העלה
                  </div>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload(f, (u) => setDraft((d) => ({ ...d, image_url: u })));
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">שם</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="למשל: שמלות"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Slug (אופציונלי)</Label>
              <Input
                dir="ltr"
                value={draft.slug}
                onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))}
                placeholder={draft.name ? slugify(draft.name) : "dresses"}
              />
            </div>
            <Button onClick={add} disabled={busy === "new"} className="bg-gradient-gold text-gold-foreground hover:opacity-90">
              <Plus className="h-4 w-4 me-1.5" />
              {busy === "new" ? "מוסיף…" : "הוסף"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Tag className="h-4 w-4 text-gold" />
            רשימת קטגוריות ({rows.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">טוען…</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground py-12 text-center">
              עדיין אין קטגוריות. הוסף אחת למעלה.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((c) => (
                <CategoryRow
                  key={c.id}
                  c={c}
                  busy={busy === c.id}
                  onSave={(p) => update(c, p)}
                  onDelete={() => remove(c)}
                  onUpload={(f, cb) => upload(f, cb)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CategoryRow({
  c,
  busy,
  onSave,
  onDelete,
  onUpload,
}: {
  c: Category;
  busy: boolean;
  onSave: (p: Partial<Category>) => void;
  onDelete: () => void;
  onUpload: (f: File, cb: (u: string) => void) => void;
}) {
  const [name, setName] = useState(c.name);
  const [slug, setSlug] = useState(c.slug);
  const [img, setImg] = useState(c.image_url ?? "");
  useEffect(() => {
    setName(c.name);
    setSlug(c.slug);
    setImg(c.image_url ?? "");
  }, [c.id, c.name, c.slug, c.image_url]);

  const dirty = name !== c.name || slug !== c.slug || (img || null) !== (c.image_url || null);

  return (
    <div className="rounded-md border bg-card p-3 space-y-2.5 shadow-soft hover:shadow-elegant transition-shadow">
      <div className="flex gap-3">
        <label className="block w-20 h-20 rounded-md overflow-hidden bg-muted border cursor-pointer relative flex-shrink-0 group">
          {img ? (
            <img src={img} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <Upload className="h-4 w-4" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Upload className="h-4 w-4 text-white" />
          </div>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f, setImg);
              e.target.value = "";
            }}
          />
        </label>
        <div className="flex-1 min-w-0 space-y-1.5">
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" />
          <Input
            dir="ltr"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="h-8 text-xs font-mono"
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 pt-1 border-t">
        {img && img !== (c.image_url ?? "") && (
          <Button size="sm" variant="ghost" onClick={() => setImg(c.image_url ?? "")}>
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          disabled={busy}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5 me-1" /> מחק
        </Button>
        <Button
          size="sm"
          disabled={!dirty || busy}
          onClick={() => onSave({ name: name.trim(), slug: slug.trim() || slugify(name), image_url: img || null })}
          className="bg-gradient-gold text-gold-foreground hover:opacity-90"
        >
          <Save className="h-3.5 w-3.5 me-1" />
          {busy ? "שומר…" : "שמור"}
        </Button>
      </div>
    </div>
  );
}
