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
import { useRealtime } from "@/hooks/use-realtime";
import { cn } from "@/lib/utils";
import { z } from "zod";
import { signalAppDataChanged } from "@/lib/realtime-sync";

const SIZE_RE = /^[A-Za-z0-9\u0590-\u05FF \-/.]{1,12}$/;
const COLOR_RE = /^[A-Za-z\u0590-\u05FF][A-Za-z\u0590-\u05FF \-]{0,24}$/;

const productSchema = z
  .object({
    name: z.string().trim().min(2, "שם המוצר חייב להכיל לפחות 2 תווים").max(200, "שם ארוך מדי (עד 200 תווים)"),
    description: z.string().trim().max(5000, "תיאור ארוך מדי (עד 5000 תווים)").optional(),
    price: z.number({ invalid_type_error: "מחיר חייב להיות מספר" }).nonnegative("מחיר לא יכול להיות שלילי").max(1_000_000, "מחיר לא הגיוני"),
    sale_price: z.number().nonnegative("מחיר מבצע לא יכול להיות שלילי").max(1_000_000, "מחיר מבצע לא הגיוני").nullable(),
    images: z.array(z.string().url("כתובת תמונה לא תקינה")).min(1, "חובה תמונה אחת לפחות"),
    sizes: z.array(z.string()).max(50, "יותר מדי מידות"),
    colors: z.array(z.string()).max(50, "יותר מדי צבעים"),
  })
  .refine((d) => d.sale_price === null || d.price === 0 || d.sale_price < d.price, {
    message: "מחיר המבצע חייב להיות נמוך מהמחיר הרגיל",
    path: ["sale_price"],
  });
type FieldErrors = Partial<Record<"name" | "price" | "sale_price" | "images" | "sizes" | "colors" | "stock" | "form", string>>;

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
    new Promise<T>((_, reject) => globalThis.setTimeout(() => reject(new Error(message)), QUERY_TIMEOUT_MS)),
  ]);
}

function productSaveErrorMessage(err: unknown) {
  const supabaseError = err as { message?: string; details?: string; hint?: string; code?: string };
  const raw = [supabaseError.message, supabaseError.details, supabaseError.hint, supabaseError.code]
    .filter(Boolean)
    .join(" · ") || (err instanceof Error ? err.message : String(err));

  if (/row-level security|permission|denied|42501|unauthorized|not authorized/i.test(raw)) {
    return "אין הרשאה לבצע פעולה זו. ודא שהמשתמש מחובר כאדמין ושיש RLS מתאים ל-products ול-product_variants.";
  }
  if (/timeout|לוקח יותר מדי זמן/i.test(raw)) return raw;
  return `שגיאה בשמירת המוצר: ${raw}`;
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
    video_url: "",
    video_size: "large" as "small" | "medium" | "large" | "full",
    category_id: "",
    featured: false,
    active: true,
    requires_stock_approval: false,
  });
  const [uploadingVideo, setUploadingVideo] = useState(false);
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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const applyProductRows = (p: any, variantsData: Variant[]) => {
    setForm({
      name: p.name ?? "",
      description: p.description ?? "",
      price: p.price != null ? String(p.price) : "",
      sale_price: p.sale_price != null ? String(p.sale_price) : "",
      images: Array.isArray(p.images) ? p.images.filter((u: unknown): u is string => typeof u === "string") : [],
      video_url: p.video_url ?? "",
      video_size: (p.video_size ?? "large") as "small" | "medium" | "large" | "full",
      category_id: p.category_id ?? "",
      featured: !!p.featured,
      active: p.active ?? true,
      requires_stock_approval: !!p.requires_stock_approval,
    });

    const sset = new Set<string>();
    const cset = new Set<string>();
    const map: Record<string, number> = {};
    variantsData.forEach((x) => {
      const s = x.size ?? "";
      const c = x.color ?? "";
      if (s) sset.add(s);
      if (c) cset.add(c);
      map[`${s}|${c}`] = x.stock ?? 0;
    });
    setSizes([...sset]);
    setColors([...cset]);
    setStockMap(map);
  };

  const loadCurrentProduct = async () => {
    if (isNew) return;
    const [pRes, vRes] = await Promise.all([
      supabase.from("products").select("*").eq("id", id).maybeSingle(),
      supabase.from("product_variants").select("*").eq("product_id", id),
    ]);
    if (pRes.error || !pRes.data) return;
    applyProductRows(pRes.data, (vRes.data ?? []) as Variant[]);
  };

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
        if (vRes.error) console.error("variants load:", vRes.error);
        applyProductRows(pRes.data, (vRes.data ?? []) as Variant[]);
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
  useRealtime(isNew ? "" : "products", loadCurrentProduct, `id=eq.${id}`);
  useRealtime(isNew ? "" : "product_variants", loadCurrentProduct, `product_id=eq.${id}`);

  const uploadImage = async (file: File) => {
    if (!user) {
      toast.error("Not signed in");
      return;
    }
    try {
      const { validateImageFile, downscaleImage } = await import("@/lib/security");
      const v = await validateImageFile(file);
      if (!v.ok) {
        toast.error(v.error);
        return;
      }
      const small = await downscaleImage(file);
      const ext = small.type === "image/png" ? "png" : small.type === "image/webp" ? "webp" : "jpg";
      const path = `products/${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("upload").upload(path, small, {
        contentType: small.type,
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

  const uploadVideo = async (file: File) => {
    if (!user) { toast.error("Not signed in"); return; }
    try {
      setUploadingVideo(true);
      const { validateVideoFile } = await import("@/lib/security");
      const v = await validateVideoFile(file);
      if (!v.ok) { toast.error(v.error); return; }
      const path = `products/${user.id}/video-${Date.now()}-${crypto.randomUUID()}.${v.ext}`;
      const { error } = await supabase.storage.from("upload").upload(path, file, {
        contentType: file.type, upsert: false, cacheControl: "3600",
      });
      if (error) { toast.error("Video upload failed: " + error.message); return; }
      const { data } = supabase.storage.from("upload").getPublicUrl(path);
      setForm((f) => ({ ...f, video_url: data.publicUrl }));
      toast.success("הסרטון הועלה");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingVideo(false);
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
    setFieldErrors({});

    // 1) Verify session
    const { data: sessionData, error: sessionErr } = await supabase.auth.getUser();
    if (sessionErr || !sessionData?.user) {
      console.error("auth.getUser failed:", sessionErr);
      const msg = "עליך להתחבר כדי לשמור מוצרים.";
      setSaveError(msg);
      toast.error(msg);
      return;
    }

    // 2) Verify admin role from public.user_roles
    const { data: roleData, error: roleErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", sessionData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (roleErr) console.error("user_roles check failed:", roleErr);
    if (!roleData) {
      const msg = "אין לך הרשאת מנהל";
      setSaveError(msg);
      toast.error(msg);
      return;
    }

    const priceNum = form.price === "" ? NaN : Number(form.price);
    const saleNum = form.sale_price === "" ? null : Number(form.sale_price);

    const parsed = productSchema.safeParse({
      name: form.name,
      description: form.description,
      price: priceNum,
      sale_price: saleNum,
      images: form.images,
      sizes,
      colors,
    });

    const errs: FieldErrors = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof FieldErrors;
        if (k && !errs[k]) errs[k] = issue.message;
      }
    }

    // size/color format validation
    const badSize = sizes.find((s) => !SIZE_RE.test(s));
    if (badSize) errs.sizes = `מידה לא תקינה: "${badSize}" (עד 12 תווים, אותיות/ספרות/מקף)`;
    if (sizes.length !== new Set(sizes).size) errs.sizes = "יש מידות כפולות";

    const badColor = colors.find((c) => !COLOR_RE.test(c));
    if (badColor) errs.colors = `שם צבע לא תקין: "${badColor}" (אותיות בלבד, עד 25 תווים)`;
    if (colors.length !== new Set(colors).size) errs.colors = "יש צבעים כפולים";

    // discount sanity (skip when product is free)
    if (Number.isFinite(priceNum) && priceNum > 0 && saleNum !== null) {
      const discount = ((priceNum - saleNum) / priceNum) * 100;
      if (discount < 1) errs.sale_price = "ההנחה חייבת להיות לפחות 1% מהמחיר";
      if (discount > 95) errs.sale_price = "ההנחה גדולה מ-95% — בדוק את המחירים";
    }

    // variants/stock validation
    const variantsPreview = (() => {
      const ss = sizes.length ? sizes : [""];
      const cc = colors.length ? colors : [""];
      const out: { key: string; size: string; color: string; stock: number }[] = [];
      for (const s of ss)
        for (const c of cc) {
          if (!s && !c) continue;
          const stock = stockMap[`${s}|${c}`];
          out.push({ key: `${s}|${c}`, size: s, color: c, stock: Number.isFinite(stock) ? stock : 0 });
        }
      return out;
    })();
    if (variantsPreview.length > 0) {
      const totalStock = variantsPreview.reduce((a, v) => a + (v.stock || 0), 0);
      const negative = variantsPreview.find((v) => v.stock < 0);
      const tooBig = variantsPreview.find((v) => v.stock > 100000);
      const nonInt = variantsPreview.find((v) => !Number.isInteger(v.stock));
      if (negative) errs.stock = "אין מלאי שלילי";
      else if (nonInt) errs.stock = "המלאי חייב להיות מספר שלם";
      else if (tooBig) errs.stock = "מלאי גדול מדי (עד 100,000 ליחידה)";
      else if (totalStock === 0) errs.stock = "סה״כ המלאי 0 — הזן כמות לפחות לקומבינציה אחת";
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      const first = Object.values(errs)[0];
      setSaveError(first ?? "יש שגיאות בטופס");
      toast.error(first ?? "יש שגיאות בטופס");
      return;
    }

    setBusy(true);
    try {
      let productId = id;
      const trimmedName = form.name.trim();

      if (isNew) {
        const insertPayload = {
          name: trimmedName,
          slug: `${slugify(trimmedName)}-${Date.now().toString(36)}`,
          description: form.description ?? "",
          price: priceNum,
          sale_price: saleNum,
          images: form.images,
          video_url: form.video_url || null,
          video_size: form.video_size,
          category_id: form.category_id || null,
          featured: form.featured,
          active: form.active,
          requires_stock_approval: form.requires_stock_approval,
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
          video_url: form.video_url || null,
          video_size: form.video_size,
          category_id: form.category_id || null,
          featured: form.featured,
          active: form.active,
          requires_stock_approval: form.requires_stock_approval,
        };
        const { data, error } = await withTimeout(
          supabase.from("products").update(updatePayload).eq("id", id).select("id").single(),
          "עדכון המוצר לוקח יותר מדי זמן. בדוק הרשאות RLS וחיבור ל-Supabase.",
        );
        if (error) throw error;
        if (!data?.id) throw new Error("לא נמצא מוצר לעדכון או שאין הרשאה לעדכן אותו.");
      }

      if (!isNew) {
        const { error: delErr } = await withTimeout(
          supabase.from("product_variants").delete().eq("product_id", productId),
          "עדכון הווריאנטים לוקח יותר מדי זמן. בדוק הרשאות לטבלת product_variants.",
        );
        if (delErr) throw delErr;
      }

      const variants = buildVariants();
      if (variants.length) {
          const rows = variants.map((v) => ({
          product_id: productId,
            size: v.size ?? "",
            color: v.color ?? "",
          stock: Number(v.stock) || 0,
        }));
        const { error: insErr } = await withTimeout(
          supabase.from("product_variants").insert(rows),
          "שמירת הווריאנטים לוקחת יותר מדי זמן. בדוק הרשאות לטבלת product_variants.",
        );
        if (insErr) throw insErr;
      }

      signalAppDataChanged("products");
      toast.success("המוצר נשמר בהצלחה");
      navigate({ to: "/admin/products" });
    } catch (err) {
      console.error("Save failed:", err);
      const friendly = productSaveErrorMessage(err);
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
    <div className="max-w-4xl mx-auto space-y-8 pb-24">
      <div className="relative overflow-hidden rounded-2xl border bg-card/60 backdrop-blur p-6 sm:p-8 shadow-sm">
        <div className="absolute inset-x-0 top-0 h-px hairline-gold" />
        <Link to="/admin/products" className="text-xs uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground transition">
          ← {t("admin.products")}
        </Link>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold mt-3 text-gradient-gold">
          {isNew ? t("admin.addProduct") : t("admin.editProduct")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">ניהול פרטי מוצר, תמונות, מידות, צבעים ומלאי.</p>
      </div>

      {saveError && (
        <div className="border border-destructive/40 bg-destructive/10 text-destructive rounded-xl p-4 flex gap-2 text-sm shadow-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span className="break-words">{saveError}</span>
        </div>
      )}

      <form onSubmit={submit} className="space-y-6">
        {/* Basics */}
        <section className="bg-card/70 backdrop-blur border rounded-2xl p-6 sm:p-7 shadow-sm transition hover:shadow-md space-y-4">
          <h2 className="font-display text-lg font-semibold tracking-wide flex items-center gap-2 before:content-[''] before:w-1 before:h-5 before:bg-gradient-gold before:rounded-full">Details</h2>
          <div className="space-y-2">
            <Label>Product name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              maxLength={200}
              className={cn(fieldErrors.name && "border-destructive focus-visible:ring-destructive")}
              aria-invalid={!!fieldErrors.name}
            />
            {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              rows={4}
              maxLength={5000}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <p className="text-xs text-muted-foreground text-end">{form.description.length}/5000</p>
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
                className={cn(fieldErrors.price && "border-destructive focus-visible:ring-destructive")}
                aria-invalid={!!fieldErrors.price}
              />
              <button
                type="button"
                onClick={() => setForm({ ...form, price: "0", sale_price: "" })}
                className="text-xs text-primary hover:underline"
              >
                הפוך למוצר חינם (0₪) — לבדיקת מערכת התשלומים
              </button>
              {Number(form.price) === 0 && form.price !== "" && (
                <p className="text-xs text-gold font-semibold">🆓 מוצר חינם — שימושי לבדיקת checkout</p>
              )}
              {fieldErrors.price && <p className="text-xs text-destructive">{fieldErrors.price}</p>}
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
                className={cn(fieldErrors.sale_price && "border-destructive focus-visible:ring-destructive")}
                aria-invalid={!!fieldErrors.sale_price}
              />
              {(() => {
                const p = Number(form.price);
                const s = Number(form.sale_price);
                if (form.sale_price !== "" && Number.isFinite(p) && Number.isFinite(s) && p > 0 && s < p) {
                  const pct = Math.round(((p - s) / p) * 100);
                  return <p className="text-xs text-gold">חיסכון של {pct}%</p>;
                }
                return null;
              })()}
              {fieldErrors.sale_price && <p className="text-xs text-destructive">{fieldErrors.sale_price}</p>}
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
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={form.requires_stock_approval}
                onCheckedChange={(v) => setForm({ ...form, requires_stock_approval: v })}
              />
              דורש אישור מלאי לפני רכישה
            </label>
          </div>
          {form.requires_stock_approval && (
            <p className="text-xs text-muted-foreground bg-muted/40 rounded p-2">
              ההזמנות של מוצר זה יקבלו סטטוס "ממתין לאישור מלאי" — תוכל לאשר/לדחות אותן מתוך עמוד ההזמנה.
            </p>
          )}
        </section>

        {/* Images */}
        <section className="bg-card/70 backdrop-blur border rounded-2xl p-6 sm:p-7 shadow-sm transition hover:shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold tracking-wide flex items-center gap-2 before:content-[''] before:w-1 before:h-5 before:bg-gradient-gold before:rounded-full">Images</h2>
            {fieldErrors.images && (
              <p className="text-xs text-destructive">{fieldErrors.images}</p>
            )}
            <span className="text-xs text-muted-foreground">
              PNG / JPG / WEBP · max 10MB · first image is the cover
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
                accept="image/png,image/jpeg,image/webp"
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

        {/* Video (optional) */}
        <section className="bg-card/70 backdrop-blur border rounded-2xl p-6 sm:p-7 shadow-sm transition hover:shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold tracking-wide flex items-center gap-2 before:content-[''] before:w-1 before:h-5 before:bg-gradient-gold before:rounded-full">סרטון מוצר (אופציונלי)</h2>
            <span className="text-xs text-muted-foreground">MP4 / WEBM / MOV · עד 200MB · או קישור YouTube/Vimeo</span>
          </div>
          {form.video_url && (
            <div className="relative w-full max-w-md rounded overflow-hidden border bg-black">
              {/youtube\.com|youtu\.be|vimeo\.com/i.test(form.video_url) ? (
                <div className="aspect-video bg-muted flex items-center justify-center text-sm text-muted-foreground p-4 text-center break-all">
                  קישור חיצוני: {form.video_url}
                </div>
              ) : (
                <video src={form.video_url} controls className="w-full aspect-video" />
              )}
              <button
                type="button"
                onClick={() => setForm({ ...form, video_url: "" })}
                className="absolute top-2 end-2 bg-destructive text-destructive-foreground rounded p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={form.video_url}
              onChange={(e) => setForm({ ...form, video_url: e.target.value })}
              onKeyDown={blockEnterSubmit}
              placeholder="https://... (YouTube / Vimeo / קובץ וידאו)"
            />
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm cursor-pointer hover:bg-muted whitespace-nowrap">
              <Upload className="h-4 w-4" /> {uploadingVideo ? "מעלה…" : "העלה סרטון"}
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                hidden
                disabled={uploadingVideo}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadVideo(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <div className="grid sm:grid-cols-[200px,1fr] gap-2 items-center pt-2 border-t">
            <label className="text-sm font-medium">גודל חלון הסרטון</label>
            <Select
              value={form.video_size}
              onValueChange={(v) => setForm({ ...form, video_size: v as typeof form.video_size })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">קטן (max 400px)</SelectItem>
                <SelectItem value="medium">בינוני (max 600px)</SelectItem>
                <SelectItem value="large">גדול (max 900px) — ברירת מחדל</SelectItem>
                <SelectItem value="full">מלא (רוחב מקסימלי)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        {/* Sizes */}
        <section className="bg-card/70 backdrop-blur border rounded-2xl p-6 sm:p-7 shadow-sm transition hover:shadow-md space-y-3">
          <h2 className="font-display text-lg font-semibold tracking-wide flex items-center gap-2 before:content-[''] before:w-1 before:h-5 before:bg-gradient-gold before:rounded-full">Sizes</h2>
          {fieldErrors.sizes && (
            <p className="text-xs text-destructive">{fieldErrors.sizes}</p>
          )}
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
        <section className="bg-card/70 backdrop-blur border rounded-2xl p-6 sm:p-7 shadow-sm transition hover:shadow-md space-y-3">
          <h2 className="font-display text-lg font-semibold tracking-wide flex items-center gap-2 before:content-[''] before:w-1 before:h-5 before:bg-gradient-gold before:rounded-full">Colors</h2>
          {fieldErrors.colors && (
            <p className="text-xs text-destructive">{fieldErrors.colors}</p>
          )}
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
          <section className="bg-card/70 backdrop-blur border rounded-2xl p-6 sm:p-7 shadow-sm transition hover:shadow-md space-y-3">
            <h2 className="font-display text-lg font-semibold tracking-wide flex items-center gap-2 before:content-[''] before:w-1 before:h-5 before:bg-gradient-gold before:rounded-full">Stock per variant</h2>
            {fieldErrors.stock && (
              <p className="text-xs text-destructive">{fieldErrors.stock}</p>
            )}
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

        <div className="flex flex-col-reverse sm:flex-row gap-3 sticky bottom-0 bg-background/90 backdrop-blur-xl py-4 -mx-2 px-2 border-t z-10">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: "/admin/products" })}
            disabled={busy}
            className="sm:w-40 h-11 rounded-full"
          >
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={busy} className="flex-1 h-11 rounded-full bg-gradient-gold text-gold-foreground hover:opacity-90 ring-gold-soft font-semibold tracking-wide">
            {busy ? "שומר..." : t("common.save")}
          </Button>
        </div>
      </form>
    </div>
  );
}
