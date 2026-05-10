import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/orders/")({
  component: AdminOrders,
});

type Row = {
  id: string;
  status: string;
  total: number;
  created_at: string;
  user_id: string;
  shipping_address: { full_name?: string } | null;
};

function AdminOrders() {
  const { t } = useT();
  const [rows, setRows] = useState<Row[]>([]);

  const load = () =>
    supabase.from("orders").select("*").order("created_at", { ascending: false }).then(({ data }) =>
      setRows((data ?? []) as Row[]),
    );

  useEffect(() => {
    load();
    const ch = supabase.channel("admin-orders-list").on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders" },
      () => load(),
    ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const del = async (id: string) => {
    if (!confirm("למחוק את ההזמנה?")) return;
    await supabase.from("order_items").delete().eq("order_id", id);
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) {
      const msg = /row-level security|permission|denied/i.test(error.message)
        ? "אין הרשאה למחוק. ודא שאתה מחובר כאדמין."
        : "שגיאה במחיקה: " + error.message;
      toast.error(msg);
    } else { toast.success("ההזמנה נמחקה"); load(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold">{t("admin.orders")}</h1>
        <Button asChild><Link to="/admin/orders/new"><Plus className="h-4 w-4 me-1" /> {t("admin.newOrder")}</Link></Button>
      </div>
      <div className="border rounded-lg bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="p-3 text-start">Order</th>
              <th className="p-3 text-start">Customer</th>
              <th className="p-3 text-start">Date</th>
              <th className="p-3 text-start">Status</th>
              <th className="p-3 text-start">Total</th>
              <th className="p-3 text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="p-3 font-mono text-xs">#{r.id.slice(0, 8)}</td>
                <td className="p-3">{r.shipping_address?.full_name ?? "—"}</td>
                <td className="p-3 text-xs">{new Date(r.created_at).toLocaleString()}</td>
                <td className="p-3"><span className="text-xs uppercase bg-muted px-2 py-0.5 rounded">{r.status}</span></td>
                <td className="p-3 font-semibold">${Number(r.total).toFixed(2)}</td>
                <td className="p-3 text-end">
                  <Button asChild size="sm" variant="outline"><Link to="/admin/orders/$id" params={{ id: r.id }}>View</Link></Button>
                  <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No orders.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
