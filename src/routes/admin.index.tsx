import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useT } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, DollarSign, Users, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { t } = useT();
  const [stats, setStats] = useState({ orders: 0, revenue: 0, customers: 0, lowStock: 0 });
  const [recent, setRecent] = useState<{ id: string; total: number; status: string; created_at: string }[]>([]);

  useEffect(() => {
    const load = async () => {
      const [{ data: orders }, { count: customers }, { data: variants }] = await Promise.all([
        supabase.from("orders").select("id,total,status,created_at").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("product_variants").select("stock"),
      ]);
      const all = orders ?? [];
      setStats({
        orders: all.length,
        revenue: all.filter((o) => o.status !== "cancelled").reduce((n, o) => n + Number(o.total), 0),
        customers: customers ?? 0,
        lowStock: (variants ?? []).filter((v) => (v.stock ?? 0) <= 3).length,
      });
      setRecent(all.slice(0, 8));
    };
    load();
    const ch = supabase.channel("admin-orders").on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders" },
      () => load(),
    ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const cards = [
    { label: t("admin.totalOrders"), value: stats.orders, icon: ShoppingCart },
    { label: t("admin.revenue"), value: `$${stats.revenue.toFixed(2)}`, icon: DollarSign },
    { label: t("admin.customersCount"), value: stats.customers, icon: Users },
    { label: t("admin.lowStock"), value: stats.lowStock, icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">{t("admin.dashboard")}</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs uppercase text-muted-foreground tracking-wider">{c.label}</CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent orders</CardTitle></CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <div className="space-y-2">
              {recent.map((o) => (
                <Link key={o.id} to="/admin/orders/$id" params={{ id: o.id }}
                  className="flex items-center justify-between p-3 rounded border hover:bg-muted/40">
                  <div>
                    <div className="font-medium text-sm">#{o.id.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</div>
                  </div>
                  <div className="text-end">
                    <span className="text-xs uppercase bg-muted px-2 py-0.5 rounded">{o.status}</span>
                    <div className="font-semibold text-sm mt-1">${Number(o.total).toFixed(2)}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
