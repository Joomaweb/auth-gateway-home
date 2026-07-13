import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Upload, Save, X, Tag, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { signalAppDataChanged } from "@/lib/realtime-sync";

export const Route = createFileRoute("/admin/categories")({
  component: AdminCategories,
});

type Category = {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  parent_id: string | null;
};

const NONE = "__none__";

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
  if (/column .*parent_id.* does not exist/i.test(m))
    return "חסר טור parent_id במסד — הרץ את db/add-category-parent.sql ב-Supabase SQL editor";
  return m || "שגיאה לא ידועה";
}

function AdminCategories() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ name: string; slug: string; image_url: string; parent_id: string }>({
    name: "",
    slug: "",
    image_url: "",
    parent_id: NONE,
  });

  const load = async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("id,name,slug,image_url,parent_id")
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
    const { error } = await supabase.from("categories").insert({
      name,
      slug,
      image_url: draft.image_url || null,
      parent_id: draft.parent_id === NONE ? null : draft.parent_id,
    });
    setBusy(null);
    if (error) return toast.error(mapErr(error));
    signalAppDataChanged("categories");
    toast.success("הקטגוריה נוספה");
    setDraft({ name: "", slug: "", image_url: "", parent_id: NONE });
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
    signalAppDataChanged("categories");
    toast.success("נשמר");
  };

  const remove = async (c: Category) => {
    const childCount = rows.filter((r) => r.parent_id === c.id).length;
    const msg = childCount
      ? `ל-"${c.name}" יש ${childCount} תתי-קטגוריות שיהפכו לקטגוריות-על. למחוק?`
      : `למחוק את "${c.name}"?`;
    if (!confirm(msg)) return;
    setBusy(c.id);
    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    setBusy(null);
    if (error) return toast.error(mapErr(error));
    signalAppDataChanged("categories");
    toast.success("נמחק");
  };

  const topLevel = useMemo(() => rows.filter((r) => !r.parent_id), [rows]);
  const childrenOf = useMemo(() => {
    const m = new Map<string, Category[]>();
    rows.forEach((r) => {
      if (r.parent_id) {
        const arr = m.get(r.parent_id) ?? [];
        arr.push(r);
        m.set(r.parent_id, arr);
      }
    });
    return m;
  }, [rows]);

  // Prevent assigning a category as its own descendant
  const descendantsOf = (id: string): Set<string> => {
    const out = new Set<string>([id]);
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop()!;
      (childrenOf.get(cur) ?? []).forEach((c) => {
        if (!out.has(c.id)) {
          out.add(c.id);
          stack.push(c.id);
        }
      });
    }
    return out;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-semibold">קטגוריות</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            תומך בהיררכיה — למשל Woman → Tops → פריט. הוסף קטגוריית-על ואז תת-קטגוריות תחתיה.
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
          <div className="grid gap-3 md:grid-cols-[110px_1fr_1fr_1fr_auto] items-end">
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
                placeholder="למשל: Tops"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Slug (אופציונלי)</Label>
              <Input
                dir="ltr"
                value={draft.slug}
                onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))}
                placeholder={draft.name ? slugify(draft.name) : "tops"}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">קטגוריית-על (אופציונלי)</Label>
              <Select
                value={draft.parent_id}
                onValueChange={(v) => setDraft((d) => ({ ...d, parent_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="ללא — קטגוריה ראשית" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>ללא — קטגוריה ראשית</SelectItem>
                  {rows.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.parent_id
                        ? `${rows.find((r) => r.id === c.parent_id)?.name ?? "?"} › ${c.name}`
                        : c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <div className="space-y-6">
              {topLevel.map((parent) => (
                <div key={parent.id} className="space-y-3">
                  <CategoryRow
                    c={parent}
                    rows={rows}
                    forbidden={descendantsOf(parent.id)}
                    busy={busy === parent.id}
                    onSave={(p) => update(parent, p)}
                    onDelete={() => remove(parent)}
                    onUpload={(f, cb) => upload(f, cb)}
                  />
                  {(childrenOf.get(parent.id) ?? []).length > 0 && (
                    <div className="ms-6 ps-4 border-s-2 border-gold/30 space-y-2">
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <ChevronRight className="h-3 w-3" />
                        תתי-קטגוריות
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {(childrenOf.get(parent.id) ?? []).map((child) => (
                          <CategoryRow
                            key={child.id}
                            c={child}
                            rows={rows}
                            forbidden={descendantsOf(child.id)}
                            busy={busy === child.id}
                            onSave={(p) => update(child, p)}
                            onDelete={() => remove(child)}
                            onUpload={(f, cb) => upload(f, cb)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {/* Orphans: parent_id set but parent missing */}
              {rows.filter((r) => r.parent_id && !rows.find((x) => x.id === r.parent_id)).length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">ללא קטגוריית-על תקפה</div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {rows
                      .filter((r) => r.parent_id && !rows.find((x) => x.id === r.parent_id))
                      .map((c) => (
                        <CategoryRow
                          key={c.id}
                          c={c}
                          rows={rows}
                          forbidden={descendantsOf(c.id)}
                          busy={busy === c.id}
                          onSave={(p) => update(c, p)}
                          onDelete={() => remove(c)}
                          onUpload={(f, cb) => upload(f, cb)}
                        />
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CategoryRow({
  c,
  rows,
  forbidden,
  busy,
  onSave,
  onDelete,
  onUpload,
}: {
  c: Category;
  rows: Category[];
  forbidden: Set<string>;
  busy: boolean;
  onSave: (p: Partial<Category>) => void;
  onDelete: () => void;
  onUpload: (f: File, cb: (u: string) => void) => void;
}) {
  const [name, setName] = useState(c.name);
  const [slug, setSlug] = useState(c.slug);
  const [img, setImg] = useState(c.image_url ?? "");
  const [parentId, setParentId] = useState(c.parent_id ?? NONE);
  useEffect(() => {
    setName(c.name);
    setSlug(c.slug);
    setImg(c.image_url ?? "");
    setParentId(c.parent_id ?? NONE);
  }, [c.id, c.name, c.slug, c.image_url, c.parent_id]);

  const dirty =
    name !== c.name ||
    slug !== c.slug ||
    (img || null) !== (c.image_url || null) ||
    (parentId === NONE ? null : parentId) !== (c.parent_id ?? null);

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
          <Select value={parentId} onValueChange={setParentId}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>ללא — קטגוריה ראשית</SelectItem>
              {rows
                .filter((r) => !forbidden.has(r.id))
                .map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.parent_id
                      ? `${rows.find((x) => x.id === r.parent_id)?.name ?? "?"} › ${r.name}`
                      : r.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
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
          onClick={() =>
            onSave({
              name: name.trim(),
              slug: slug.trim() || slugify(name),
              image_url: img || null,
              parent_id: parentId === NONE ? null : parentId,
            })
          }
          className="bg-gradient-gold text-gold-foreground hover:opacity-90"
        >
          <Save className="h-3.5 w-3.5 me-1" />
          {busy ? "שומר…" : "שמור"}
        </Button>
      </div>
    </div>
  );
}
