import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/use-realtime";

export const Route = createFileRoute("/admin/products")({
  component: AdminProducts,
});

type Row = {
  id: string;
  name: string;
  price: number;
  sale_price: number | null;
  active: boolean;
  featured: boolean;
  images: string[] | null;
};

function AdminProducts() {
  const { t } = useT();
  const [rows, setRows] = useState<Row[]>([]);

  const load = () => {
    supabase.from("products").select("*").order("created_at", { ascending: false }).then(({ data }) =>
      setRows((data ?? []) as Row[]),
    );
  };
  useEffect(load, []);
  useRealtime("products", load);

  const del = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    await supabase.from("product_variants").delete().eq("product_id", id);
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); load(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold">{t("admin.products")}</h1>
        <Button asChild><Link to="/admin/products/new"><Plus className="h-4 w-4 me-1" /> {t("admin.addProduct")}</Link></Button>
      </div>
      <div className="border rounded-lg bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr className="text-start">
              <th className="p-3 text-start">Image</th>
              <th className="p-3 text-start">Name</th>
              <th className="p-3 text-start">Price</th>
              <th className="p-3 text-start">Sale</th>
              <th className="p-3 text-start">Active</th>
              <th className="p-3 text-start">Featured</th>
              <th className="p-3 text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="p-3"><img src={r.images?.[0] ?? ""} alt="" className="w-10 h-12 object-cover rounded bg-muted" /></td>
                <td className="p-3 font-medium">{r.name}</td>
                <td className="p-3">${Number(r.price).toFixed(2)}</td>
                <td className="p-3">{r.sale_price ? `$${Number(r.sale_price).toFixed(2)}` : "—"}</td>
                <td className="p-3">{r.active ? "✓" : "—"}</td>
                <td className="p-3">{r.featured ? "★" : "—"}</td>
                <td className="p-3 text-end">
                  <Button asChild size="sm" variant="ghost"><Link to="/admin/products/$id" params={{ id: r.id }}><Pencil className="h-4 w-4" /></Link></Button>
                  <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No products.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
