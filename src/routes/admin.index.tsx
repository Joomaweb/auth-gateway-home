import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useT } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, DollarSign, Users, AlertTriangle } from "lucide-react";
import { invalidateRunCache, run } from "@/lib/api";
import { useRealtime } from "@/hooks/use-realtime";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { t } = useT();
  const dashboardQuery = useQuery({
    queryKey: ["admin", "dashboard"],
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    retry: 1,
    queryFn: async () => {
      const [ordersResult, customersResult, lowStockResult] = await Promise.all([
        run(
          { key: "admin:dashboard:orders", timeoutMs: 5000, attempts: 2, cacheMs: 15_000 },
          () => supabase.from("orders").select("id,total,status,created_at").order("created_at", { ascending: false }),
        ),
        run(
          { key: "admin:dashboard:customers", timeoutMs: 5000, attempts: 2, cacheMs: 15_000 },
          () => supabase.from("profiles").select("id", { count: "exact", head: true }),
        ),
        run(
          { key: "admin:dashboard:low-stock", timeoutMs: 5000, attempts: 2, cacheMs: 15_000 },
          () => supabase.from("product_variants").select("id", { count: "exact", head: true }).lte("stock", 3),
        ),
      ]);
      if (ordersResult.error) throw ordersResult.error;
      if (customersResult.error) throw customersResult.error;
      if (lowStockResult.error) throw lowStockResult.error;
      const all = ordersResult.data ?? [];
      return {
        stats: {
          orders: all.length,
          revenue: all.filter((o) => o.status !== "cancelled").reduce((n, o) => n + Number(o.total), 0),
          customers: customersResult.count ?? 0,
          lowStock: lowStockResult.count ?? 0,
        },
        recent: all.slice(0, 8) as { id: string; total: number; status: string; created_at: string }[],
      };
    },
  });

  const refreshDashboard = () => {
    invalidateRunCache("admin:dashboard:");
    dashboardQuery.refetch();
  };
  useRealtime("orders", refreshDashboard);
  useRealtime("profiles", refreshDashboard);
  useRealtime("product_variants", refreshDashboard);

  const stats = dashboardQuery.data?.stats ?? { orders: 0, revenue: 0, customers: 0, lowStock: 0 };
  const recent = dashboardQuery.data?.recent ?? [];

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
