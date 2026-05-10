import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/admin/orders/$id")({
  component: AdminOrderDetail,
});

const statuses = ["pending", "paid", "shipped", "delivered", "cancelled"];
const shipmentStatuses = ["preparing", "awaiting_shipment", "in_transit", "delivered"] as const;
type ShipmentStatus = typeof shipmentStatuses[number];

type Order = {
  id: string;
  status: string;
  shipment_status: ShipmentStatus | null;
  tracking_number: string | null;
  tracking_url: string | null;
  shipment_updated_at: string | null;
  subtotal: number;
  shipping: number;
  total: number;
  payment_method: string | null;
  shipping_address: Record<string, string> | null;
  notes: string | null;
  created_at: string;
  user_id: string;
};
type Item = { id: string; name: string; size: string | null; color: string | null; qty: number; price: number };

function AdminOrderDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { t } = useT();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("orders").select("*").eq("id", id).maybeSingle().then(async ({ data }) => {
      setOrder(data);
      if (data?.user_id) {
        const { data: p } = await supabase.from("profiles").select("email").eq("id", data.user_id).maybeSingle();
        setEmail(p?.email ?? null);
      }
    });
    supabase.from("order_items").select("*").eq("order_id", id).then(({ data }) => setItems((data ?? []) as Item[]));
  }, [id]);

  const updateStatus = async (status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Status updated"); setOrder((o) => o ? { ...o, status } : o); }
  };

  const del = async () => {
    if (!confirm("Delete order?")) return;
    await supabase.from("order_items").delete().eq("order_id", id);
    await supabase.from("orders").delete().eq("id", id);
    toast.success("Deleted");
    navigate({ to: "/admin/orders" });
  };

  if (!order) return <p className="text-muted-foreground">{t("common.loading")}</p>;
  const a = order.shipping_address;

  return (
    <div className="max-w-3xl space-y-6">
      <Link to="/admin/orders" className="text-sm text-muted-foreground hover:text-foreground">← {t("admin.orders")}</Link>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold">Order #{order.id.slice(0, 8)}</h1>
        <Button variant="destructive" onClick={del}>{t("common.delete")}</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="border rounded-lg p-4 bg-card">
          <div className="text-xs uppercase text-muted-foreground mb-2">Status</div>
          <Select value={order.status} onValueChange={updateStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="border rounded-lg p-4 bg-card">
          <div className="text-xs uppercase text-muted-foreground">Customer</div>
          <div className="font-medium">{a?.full_name ?? "—"}</div>
          <div className="text-xs text-muted-foreground">{email ?? ""}</div>
          <div className="text-xs text-muted-foreground">{a?.phone ?? ""}</div>
        </div>
      </div>

      <div className="border rounded-lg p-4 bg-card">
        <h3 className="font-semibold mb-3">Items</h3>
        <div className="space-y-2 text-sm">
          {items.map((i) => (
            <div key={i.id} className="flex justify-between">
              <div>{i.name} {i.size && `· ${i.size}`} {i.color && `· ${i.color}`} × {i.qty}</div>
              <div>${(i.qty * Number(i.price)).toFixed(2)}</div>
            </div>
          ))}
        </div>
        <div className="border-t mt-3 pt-3 text-sm space-y-1">
          <div className="flex justify-between"><span>Subtotal</span><span>${Number(order.subtotal).toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Shipping</span><span>${Number(order.shipping).toFixed(2)}</span></div>
          <div className="flex justify-between font-semibold pt-1 border-t"><span>Total</span><span>${Number(order.total).toFixed(2)}</span></div>
        </div>
      </div>

      {a && (
        <div className="border rounded-lg p-4 bg-card text-sm">
          <h3 className="font-semibold mb-2">Shipping</h3>
          <div className="text-muted-foreground">
            {a.address}, {a.city} {a.zip}<br />{a.country}<br />{a.method}
          </div>
        </div>
      )}

      {order.notes && (
        <div className="border rounded-lg p-4 bg-card text-sm">
          <h3 className="font-semibold mb-1">Notes</h3>
          <p className="text-muted-foreground">{order.notes}</p>
        </div>
      )}
    </div>
  );
}
