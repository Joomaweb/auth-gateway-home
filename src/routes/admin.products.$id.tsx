import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { supabase } from "@/lib/supabase";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AlertCircle, Plus, Upload, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/products/$id")({
  component: ProductEdit,
});

type Variant = { id?: string; size: string | null; color: string | null; stock: number };

const SIZE_PRESETS = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "One Size"];
const SIZE_NUMERIC = ["36", "38", "40", "42", "44", "46"];
const COLOR_PRESETS: { name: string; hex: string }[] = [
  { name: "Black", hex: "#000000" },
  { name: "White", hex: "#ffffff" },
  { name: "Gray", hex: "#9ca3af" },
  { name: "Beige", hex: "#d6c9a3" },
  { name: "Brown", hex: "#7c4a1e" },
  { name: "Navy", hex: "#1e2a44" },
  { name: "Blue", hex: "#3b82f6" },
  { name: "Red", hex: "#dc2626" },
  { name: "Green", hex: "#16a34a" },
  { name: "Pink", hex: "#ec4899" },
  { name: "Yellow", hex: "#eab308" },
];

const NONE = "__none__";
const QUERY_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: PromiseLike<T>, message: string) {
  return Promise.race<T>([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error(message)), QUERY_TIMEOUT_MS)),
  ]);
}

function slugify(s: string) {
  const base = s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  return base || `p-${Date.now()}`;
}

function blockEnterSubmit(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === "Enter") e.preventDefault();
}

function ProductEdit() {
  const { id } = Route.useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const { t } = useT();
  const { user, loading: authLoading } = useAuth();

  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "" as string,
    sale_price: "" as string,
    images: [] as string[],
    category_id: "",
    featured: false,
    active: true,
  });
  const [sizes, setSizes] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [customSize, setCustomSize] = useState("");
  const [customColor, setCustomColor] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load categories + (if editing) the product itself
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: catsData, error: catsErr } = await withTimeout(
          supabase.from("categories").select("id,name").order("name"),
          "החיבור לקטגוריות לוקח יותר מדי זמן. בדוק את החיבור ל-Supabase ונסה שוב.",
        );
        if (catsErr) console.error("categories load:", catsErr);
        if (!cancelled) setCats((catsData ?? []) as { id: string; name: string }[]);

        if (isNew) {
          if (!cancelled) setLoading(false);
          return;
        }

        const [pRes, vRes] = await Promise.all([
          withTimeout(
            supabase.from("products").select("*").eq("id", id).maybeSingle(),
            "החיבור למוצר לוקח יותר מדי זמן. נסה לרענן את העמוד.",
          ),
          withTimeout(
            supabase.from("product_variants").select("*").eq("product_id", id),
            "החיבור לווריאנטים לוקח יותר מדי זמן. נסה לרענן את העמוד.",
          ),
        ]);

        if (cancelled) return;

        if (pRes.error) throw pRes.error;
        if (!pRes.data) {
          setLoadError("Product not found");
          setLoading(false);
          return;
        }
        const p = pRes.data;
        setForm({
          name: p.name ?? "",
          description: p.description ?? "",
          price: p.price != null ? String(p.price) : "",
          sale_price: p.sale_price != null ? String(p.sale_price) : "",
          images: Array.isArray(p.images) ? p.images : [],
          category_id: p.category_id ?? "",
          featured: !!p.featured,
          active: p.active ?? true,
        });

        if (vRes.error) console.error("variants load:", vRes.error);
        const vs = (vRes.data ?? []) as Variant[];
        const sset = new Set<string>();
        const cset = new Set<string>();
        const map: Record<string, number> = {};
        vs.forEach((x) => {
          const s = x.size ?? "";
          const c = x.color ?? "";
          if (s) sset.add(s);
          if (c) cset.add(c);
          map[`${s}|${c}`] = x.stock ?? 0;
        });
        setSizes([...sset]);
        setColors([...cset]);
        setStockMap(map);
      } catch (err) {
        console.error("Product load failed:", err);
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load product");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isNew]);

  const uploadImage = async (file: File) => {
    if (!user) {
      toast.error("Not signed in");
      return;
    }
    try {
      const { validateImageFile } = await import("@/lib/security");
      const v = await validateImageFile(file);
      if (!v.ok) {
        toast.error(v.error);
        return;
      }
      const path = `products/${user.id}/${Date.now()}-${crypto.randomUUID()}.${v.ext}`;
      const { error } = await supabase.storage.from("upload").upload(path, file, {
        contentType: file.type,
        upsert: false,
        cacheControl: "3600",
      });
      if (error) {
        toast.error("Upload failed: " + error.message);
        return;
      }
      const { data } = supabase.storage.from("upload").getPublicUrl(path);
      setForm((f) => ({ ...f, images: [...f.images, data.publicUrl] }));
      toast.success("Image uploaded");
    } catch (err) {
      console.error("Upload failed:", err);
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const moveImage = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= form.images.length) return;
    const arr = [...form.images];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setForm({ ...form, images: arr });
  };

  const toggleSize = (s: string) =>
    setSizes((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  const toggleColor = (c: string) =>
    setColors((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));
  const setStock = (s: string, c: string, val: number) =>
    setStockMap((m) => ({ ...m, [`${s}|${c}`]: val }));

  const buildVariants = (): Variant[] => {
    const ss = sizes.length ? sizes : [""];
    const cc = colors.length ? colors : [""];
    const out: Variant[] = [];
    for (const s of ss)
      for (const c of cc) {
        if (!s && !c) continue;
        out.push({ size: s || null, color: c || null, stock: stockMap[`${s}|${c}`] ?? 0 });
      }
    return out;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaveError(null);

    if (!user) {
      setSaveError("עליך להתחבר כדי לשמור מוצרים.");
      return;
    }
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setSaveError("שם המוצר נדרש.");
      return;
    }
    const priceNum = Number(form.price);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setSaveError("המחיר חייב להיות גדול מאפס.");
      return;
    }
    const saleNum = form.sale_price === "" ? null : Number(form.sale_price);
    if (saleNum !== null && (!Number.isFinite(saleNum) || saleNum < 0)) {
      setSaveError("מחיר המבצע אינו תקין.");
      return;
    }

    setBusy(true);
    try {
      let productId = id;

      if (isNew) {
        const insertPayload = {
          name: trimmedName,
          slug: `${slugify(trimmedName)}-${Date.now().toString(36)}`,
          description: form.description ?? "",
          price: priceNum,
          sale_price: saleNum,
          images: form.images,
          category_id: form.category_id || null,
          featured: form.featured,
          active: form.active,
        };
        const { data, error } = await withTimeout(
          supabase.from("products").insert(insertPayload).select("id").single(),
          "שמירת המוצר לוקחת יותר מדי זמן. בדוק הרשאות RLS וחיבור ל-Supabase.",
        );
        if (error) throw error;
        if (!data?.id) throw new Error("המוצר נוצר אך לא הוחזר מזהה");
        productId = data.id;
      } else {
        const updatePayload = {
          name: trimmedName,
          description: form.description ?? "",
          price: priceNum,
          sale_price: saleNum,
          images: form.images,
          category_id: form.category_id || null,
          featured: form.featured,
          active: form.active,
        };
        const { error } = await withTimeout(
          supabase.from("products").update(updatePayload).eq("id", id),
          "עדכון המוצר לוקח יותר מדי זמן. בדוק הרשאות RLS וחיבור ל-Supabase.",
        );
        if (error) throw error;
      }

      const { error: delErr } = await withTimeout(
        supabase.from("product_variants").delete().eq("product_id", productId),
        "עדכון הווריאנטים לוקח יותר מדי זמן. בדוק הרשאות לטבלת product_variants.",
      );
      if (delErr) throw delErr;

      const variants = buildVariants();
      if (variants.length) {
        const rows = variants.map((v) => ({
          product_id: productId,
          size: v.size,
          color: v.color,
          stock: Number(v.stock) || 0,
        }));
        const { error: insErr } = await withTimeout(
          supabase.from("product_variants").insert(rows),
          "שמירת הווריאנטים לוקחת יותר מדי זמן. בדוק הרשאות לטבלת product_variants.",
        );
        if (insErr) throw insErr;
      }

      toast.success(isNew ? "המוצר נוצר בהצלחה" : "המוצר עודכן בהצלחה");
      navigate({ to: "/admin/products" });
    } catch (err) {
      console.error("Save failed:", err);
      const raw = err instanceof Error ? err.message : String(err);
      const friendly = /row-level security|permission|denied/i.test(raw)
        ? "אין הרשאה לבצע פעולה זו. ודא שאתה מחובר כאדמין."
        : `שגיאה בשמירת המוצר: ${raw}`;
      setSaveError(friendly);
      toast.error(friendly);
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || loading) {
    return <div className="text-muted-foreground">טוען...</div>;
  }
  if (loadError) {
    return (
      <div className="max-w-2xl space-y-4">
        <Link to="/admin/products" className="text-sm text-muted-foreground hover:text-foreground">
          ← {t("admin.products")}
        </Link>
        <div className="border border-destructive/40 bg-destructive/10 text-destructive rounded-lg p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold">Could not load product</div>
            <div className="text-sm">{loadError}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link to="/admin/products" className="text-sm text-muted-foreground hover:text-foreground">
          ← {t("admin.products")}
        </Link>
        <h1 className="font-display text-3xl font-semibold mt-2">
          {isNew ? t("admin.addProduct") : t("admin.editProduct")}
        </h1>
      </div>

      {saveError && (
        <div className="border border-destructive/40 bg-destructive/10 text-destructive rounded-lg p-3 flex gap-2 text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      <form onSubmit={submit} className="space-y-6">
        {/* Basics */}
        <section className="bg-card border rounded-lg p-6 space-y-4">
          <h2 className="font-semibold">Details</h2>
          <div className="space-y-2">
            <Label>Product name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Price *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Sale price</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.sale_price}
                onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
                placeholder="optional"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.category_id || NONE}
                onValueChange={(v) => setForm({ ...form, category_id: v === NONE ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="— None —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— None —</SelectItem>
                  {cats.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-6 pt-2">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={form.featured}
                onCheckedChange={(v) => setForm({ ...form, featured: v })}
              />
              Featured
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
              Active (visible in shop)
            </label>
          </div>
        </section>

        {/* Images */}
        <section className="bg-card border rounded-lg p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Images</h2>
            <span className="text-xs text-muted-foreground">
              PNG / JPG · max 5MB · first image is the cover
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {form.images.map((src, i) => (
              <div
                key={src + i}
                className="relative w-24 h-32 group rounded overflow-hidden border bg-muted"
              >
                <img src={src} alt="" className="w-full h-full object-cover" />
                {i === 0 && (
                  <span className="absolute bottom-1 start-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded">
                    cover
                  </span>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveImage(i, -1)}
                    className="bg-background/90 text-foreground rounded px-1.5 text-xs"
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    onClick={() => moveImage(i, 1)}
                    className="bg-background/90 text-foreground rounded px-1.5 text-xs"
                  >
                    ▶
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setForm({ ...form, images: form.images.filter((_, j) => j !== i) })
                    }
                    className="bg-destructive text-destructive-foreground rounded p-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
            <label className="w-24 h-32 border-2 border-dashed rounded flex flex-col items-center justify-center cursor-pointer text-xs text-muted-foreground hover:bg-muted/40">
              <Upload className="h-4 w-4 mb-1" /> Upload
              <input
                type="file"
                accept="image/png,image/jpeg"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadImage(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <div className="space-y-2 pt-3 border-t">
            <Label className="text-xs">Or paste an image URL</Label>
            <div className="flex gap-2">
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                onKeyDown={blockEnterSubmit}
                placeholder="https://..."
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const u = imageUrl.trim();
                  if (u) {
                    setForm((f) => ({ ...f, images: [...f.images, u] }));
                    setImageUrl("");
                  }
                }}
              >
                Add
              </Button>
            </div>
          </div>
        </section>

        {/* Sizes */}
        <section className="bg-card border rounded-lg p-6 space-y-3">
          <h2 className="font-semibold">Sizes</h2>
          <div>
            <div className="text-xs text-muted-foreground mb-2">Letter sizes</div>
            <div className="flex flex-wrap gap-2">
              {SIZE_PRESETS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSize(s)}
                  className={cn(
                    "px-3 py-1.5 rounded-full border text-sm transition",
                    sizes.includes(s)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:bg-muted",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-2 mt-2">Numeric sizes</div>
            <div className="flex flex-wrap gap-2">
              {SIZE_NUMERIC.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSize(s)}
                  className={cn(
                    "px-3 py-1.5 rounded-full border text-sm transition",
                    sizes.includes(s)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:bg-muted",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Input
              placeholder="Custom size"
              value={customSize}
              onChange={(e) => setCustomSize(e.target.value)}
              onKeyDown={blockEnterSubmit}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const v = customSize.trim();
                if (v && !sizes.includes(v)) setSizes([...sizes, v]);
                setCustomSize("");
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {sizes.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t mt-3">
              {sizes.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-secondary rounded text-xs"
                >
                  {s}
                  <button type="button" onClick={() => toggleSize(s)}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Colors */}
        <section className="bg-card border rounded-lg p-6 space-y-3">
          <h2 className="font-semibold">Colors</h2>
          <div className="flex flex-wrap gap-2">
            {COLOR_PRESETS.map((c) => {
              const active = colors.includes(c.name);
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => toggleColor(c.name)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition",
                    active ? "border-primary ring-2 ring-primary/30" : "hover:bg-muted",
                  )}
                >
                  <span
                    className="w-4 h-4 rounded-full border"
                    style={{ background: c.hex }}
                  />
                  {c.name}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 pt-2">
            <Input
              placeholder="Custom color name"
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              onKeyDown={blockEnterSubmit}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const v = customColor.trim();
                if (v && !colors.includes(v)) setColors([...colors, v]);
                setCustomColor("");
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {colors.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t mt-3">
              {colors.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-secondary rounded text-xs"
                >
                  {c}
                  <button type="button" onClick={() => toggleColor(c)}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Stock matrix */}
        {(sizes.length > 0 || colors.length > 0) && (
          <section className="bg-card border rounded-lg p-6 space-y-3">
            <h2 className="font-semibold">Stock per variant</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="p-2 text-start">Size \ Color</th>
                    {(colors.length ? colors : [""]).map((c) => (
                      <th key={c || "x"} className="p-2 text-start">
                        {c || "—"}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(sizes.length ? sizes : [""]).map((s) => (
                    <tr key={s || "x"} className="border-t">
                      <td className="p-2 font-medium">{s || "—"}</td>
                      {(colors.length ? colors : [""]).map((c) => (
                        <td key={c || "x"} className="p-2">
                          <Input
                            type="number"
                            min="0"
                            className="w-20"
                            value={stockMap[`${s}|${c}`] ?? 0}
                            onChange={(e) => setStock(s, c, Number(e.target.value))}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Set stock to 0 to mark a variant as out of stock.
            </p>
          </section>
        )}

        <div className="flex gap-3 sticky bottom-0 bg-background/95 backdrop-blur py-3 border-t z-10">
          <Button type="submit" disabled={busy} className="flex-1">
            {busy ? "Saving..." : t("common.save")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: "/admin/products" })}
            disabled={busy}
          >
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </div>
  );
}
