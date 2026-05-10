import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/orders/$id")({
  component: OrderDetailPage,
});

type Order = {
  id: string;
  status: string;
  subtotal: number;
  shipping: number;
  total: number;
  payment_method: string | null;
  shipping_address: Record<string, string> | null;
  notes: string | null;
  created_at: string;
};
type Item = { id: string; name: string; size: string | null; color: string | null; qty: number; price: number };

function OrderDetailPage() {
  const { id } = Route.useParams();
  const { t } = useT();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("orders").select("*").eq("id", id).maybeSingle().then(({ data }) => setOrder(data));
    supabase.from("order_items").select("*").eq("order_id", id).then(({ data }) => setItems((data ?? []) as Item[]));
  }, [id, user]);

  if (!order) return <PublicLayout><div className="max-w-3xl mx-auto px-4 py-20 text-muted-foreground">{t("common.loading")}</div></PublicLayout>;

  const a = order.shipping_address;

  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link to="/orders" className="text-sm text-muted-foreground hover:text-foreground">← {t("orders.title")}</Link>
        <h1 className="font-display text-3xl font-semibold mt-3 mb-1">{t("orders.order")} #{order.id.slice(0, 8)}</h1>
        <div className="text-sm text-muted-foreground mb-6">{new Date(order.created_at).toLocaleString()}</div>

        <div className="grid gap-4 sm:grid-cols-2 mb-6">
          <div className="border rounded-lg p-4 bg-card">
            <div className="text-xs uppercase text-muted-foreground mb-1">{t("orders.status")}</div>
            <div className="font-semibold capitalize">{order.status}</div>
          </div>
          <div className="border rounded-lg p-4 bg-card">
            <div className="text-xs uppercase text-muted-foreground mb-1">{t("checkout.payment")}</div>
            <div className="font-semibold">{order.payment_method ?? "—"}</div>
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-card mb-6">
          <h3 className="font-semibold mb-3">Items</h3>
          <div className="space-y-2 text-sm">
            {items.map((i) => (
              <div key={i.id} className="flex justify-between">
                <div>
                  <div>{i.name} × {i.qty}</div>
                  <div className="text-xs text-muted-foreground">
                    {i.size ?? ""} {i.color ?? ""}
                  </div>
                </div>
                <div className="font-medium">${(i.qty * Number(i.price)).toFixed(2)}</div>
              </div>
            ))}
          </div>
          <div className="border-t mt-4 pt-4 space-y-1 text-sm">
            <div className="flex justify-between"><span>{t("cart.subtotal")}</span><span>${Number(order.subtotal).toFixed(2)}</span></div>
            <div className="flex justify-between"><span>{t("cart.shipping")}</span><span>${Number(order.shipping).toFixed(2)}</span></div>
            <div className="flex justify-between font-semibold text-base pt-2 border-t mt-2"><span>{t("cart.total")}</span><span>${Number(order.total).toFixed(2)}</span></div>
          </div>
        </div>

        {a && (
          <div className="border rounded-lg p-4 bg-card">
            <h3 className="font-semibold mb-2">{t("checkout.shipping")}</h3>
            <div className="text-sm text-muted-foreground">
              {a.full_name} · {a.phone}<br />
              {a.address}, {a.city} {a.zip}<br />
              {a.country}
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
