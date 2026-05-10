import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { useRealtime } from "@/hooks/use-realtime";

export const Route = createFileRoute("/orders")({
  component: OrdersPage,
});

type Order = {
  id: string;
  status: string;
  total: number;
  created_at: string;
};

function OrdersPage() {
  const { t } = useT();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const load = () => {
    if (!user) return;
    supabase
      .from("orders")
      .select("id,status,total,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setOrders((data ?? []) as Order[]));
  };
  useEffect(load, [user]);
  useRealtime("orders", load, user ? `user_id=eq.${user.id}` : undefined);

  if (!user) return null;

  return (
    <PublicLayout>
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="font-display text-4xl font-semibold mb-8">{t("orders.title")}</h1>
        {orders.length === 0 ? (
          <div className="text-center py-16 border rounded-lg">
            <p className="text-muted-foreground mb-4">{t("orders.empty")}</p>
            <Button asChild><Link to="/shop">{t("nav.shop")}</Link></Button>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <Link
                key={o.id}
                to="/orders/$id"
                params={{ id: o.id }}
                className="flex items-center justify-between border rounded-lg p-4 bg-card hover:bg-muted/40"
              >
                <div>
                  <div className="font-medium">#{o.id.slice(0, 8)}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="text-end">
                  <span className="text-xs uppercase tracking-wide bg-muted px-2 py-0.5 rounded">{o.status}</span>
                  <div className="font-semibold mt-1">${Number(o.total).toFixed(2)}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
