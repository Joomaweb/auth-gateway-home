import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Plus, Upload } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/admin/products/$id")({
  component: ProductEdit,
});

type Variant = { id?: string; size: string; color: string; stock: number };

function ProductEdit() {
  const { id } = Route.useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const { t } = useT();
  const { user } = useAuth();

  const [form, setForm] = useState({
    name: "", description: "", price: 0, sale_price: "" as string | number,
    images: [] as string[], category_id: "", featured: false, active: true,
  });
  const [variants, setVariants] = useState<Variant[]>([]);
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("categories").select("id,name").then(({ data }) => setCats(data ?? []));
    if (!isNew) {
      supabase.from("products").select("*").eq("id", id).maybeSingle().then(({ data }) => {
        if (data) setForm({
          name: data.name, description: data.description ?? "",
          price: data.price, sale_price: data.sale_price ?? "",
          images: data.images ?? [], category_id: data.category_id ?? "",
          featured: data.featured, active: data.active,
        });
      });
      supabase.from("product_variants").select("*").eq("product_id", id).then(({ data }) =>
        setVariants((data ?? []) as Variant[]),
      );
    }
  }, [id]);

  const uploadImage = async (file: File) => {
    if (!user) return;
    const { validateImageFile } = await import("@/lib/security");
    const v = await validateImageFile(file);
    if (!v.ok) { toast.error(v.error); return; }
    const rand = crypto.randomUUID();
    const path = `products/${user.id}/${Date.now()}-${rand}.${v.ext}`;
    const { error } = await supabase.storage.from("upload").upload(path, file, {
      contentType: file.type,
      upsert: false,
      cacheControl: "3600",
    });
    if (error) { toast.error("העלאה נכשלה"); return; }
    const { data } = supabase.storage.from("upload").getPublicUrl(path);
    setForm((f) => ({ ...f, images: [...f.images, data.publicUrl] }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const payload = {
      name: form.name,
      slug: form.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + (isNew ? "-" + Date.now() : ""),
      description: form.description,
      price: Number(form.price),
      sale_price: form.sale_price === "" ? null : Number(form.sale_price),
      images: form.images,
      category_id: form.category_id || null,
      featured: form.featured,
      active: form.active,
    };
    let productId = id;
    if (isNew) {
      const { data, error } = await supabase.from("products").insert(payload).select().single();
      if (error || !data) { setBusy(false); toast.error(error?.message ?? "Error"); return; }
      productId = data.id;
    } else {
      const { slug: _, ...rest } = payload;
      const { error } = await supabase.from("products").update(rest).eq("id", id);
      if (error) { setBusy(false); toast.error(error.message); return; }
    }
    // sync variants
    await supabase.from("product_variants").delete().eq("product_id", productId);
    if (variants.length) {
      await supabase.from("product_variants").insert(
        variants.map((v) => ({
          product_id: productId, size: v.size || null, color: v.color || null, stock: Number(v.stock) || 0,
        })),
      );
    }
    setBusy(false);
    toast.success("Saved");
    navigate({ to: "/admin/products" });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link to="/admin/products" className="text-sm text-muted-foreground hover:text-foreground">← {t("admin.products")}</Link>
        <h1 className="font-display text-3xl font-semibold mt-2">{isNew ? t("admin.addProduct") : t("admin.editProduct")}</h1>
      </div>
      <form onSubmit={submit} className="space-y-4 bg-card border rounded-lg p-6">
        <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
        <div className="space-y-2"><Label>Description</Label><Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>Price</Label><Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} required /></div>
          <div className="space-y-2"><Label>Sale price (optional)</Label><Input type="number" step="0.01" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} /></div>
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Images</Label>
          <div className="flex flex-wrap gap-2">
            {form.images.map((src, i) => (
              <div key={i} className="relative w-20 h-24 group">
                <img src={src} alt="" className="w-full h-full object-cover rounded" />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, images: form.images.filter((_, j) => j !== i) })}
                  className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 text-xs"
                >×</button>
              </div>
            ))}
            <label className="w-20 h-24 border-2 border-dashed rounded flex flex-col items-center justify-center cursor-pointer text-xs text-muted-foreground hover:bg-muted/40">
              <Upload className="h-4 w-4 mb-1" /> Upload
              <input type="file" accept="image/png,image/jpeg" hidden onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
            </label>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm"><Switch checked={form.featured} onCheckedChange={(v) => setForm({ ...form, featured: v })} /> Featured</label>
          <label className="flex items-center gap-2 text-sm"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /> Active</label>
        </div>

        <div className="space-y-2 border-t pt-4">
          <div className="flex items-center justify-between">
            <Label>Variants (size / color / stock)</Label>
            <Button type="button" size="sm" variant="outline" onClick={() => setVariants([...variants, { size: "", color: "", stock: 0 }])}>
              <Plus className="h-3 w-3 me-1" /> Add
            </Button>
          </div>
          {variants.map((v, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
              <Input placeholder="Size (e.g. M)" value={v.size} onChange={(e) => setVariants(variants.map((x, j) => j === i ? { ...x, size: e.target.value } : x))} />
              <Input placeholder="Color" value={v.color} onChange={(e) => setVariants(variants.map((x, j) => j === i ? { ...x, color: e.target.value } : x))} />
              <Input type="number" placeholder="Stock" value={v.stock} onChange={(e) => setVariants(variants.map((x, j) => j === i ? { ...x, stock: Number(e.target.value) } : x))} />
              <Button type="button" size="icon" variant="ghost" onClick={() => setVariants(variants.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        <Button type="submit" disabled={busy} className="w-full">{busy ? "Saving..." : "Save"}</Button>
      </form>
    </div>
  );
}
