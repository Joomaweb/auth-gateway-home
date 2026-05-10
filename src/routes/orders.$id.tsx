import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Download, Package, Clock, Truck, CheckCircle2, AlertTriangle, XCircle, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { downloadInvoicePdf, type Company, type InvoiceOrder, type InvoiceItem } from "@/lib/invoice-pdf";
import { SquareCheckout } from "@/components/checkout/SquareCheckout";
import { useServerFn } from "@tanstack/react-start";
import { chargeSquarePayment } from "@/lib/square.functions";

export const Route = createFileRoute("/orders/$id")({
  component: OrderDetailPage,
});

const SHIPMENT_STEPS = ["preparing", "awaiting_shipment", "in_transit", "delivered"] as const;
type ShipmentStatus = typeof SHIPMENT_STEPS[number];

type Order = InvoiceOrder & {
  user_id: string;
  shipment_status?: ShipmentStatus | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
  shipment_updated_at?: string | null;
};
type Item = InvoiceItem & { id: string };

function OrderDetailPage() {
  const { id } = Route.useParams();
  const { t } = useT();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [company, setCompany] = useState<Company>({});
  const prevShipment = useRef<ShipmentStatus | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("orders").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      const o = data as Order | null;
      setOrder(o);
      prevShipment.current = (o?.shipment_status as ShipmentStatus) ?? null;
    });
    supabase.from("order_items").select("*").eq("order_id", id).then(({ data }) => setItems((data ?? []) as Item[]));
    supabase.from("store_settings").select("company").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data?.company) setCompany(data.company as Company);
    });

    const channel = supabase
      .channel(`order-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` },
        (payload) => {
          const next = payload.new as Order;
          setOrder((cur) => (cur ? { ...cur, ...next } : (next as Order)));
          const newStatus = (next.shipment_status as ShipmentStatus) ?? null;
          if (newStatus && newStatus !== prevShipment.current) {
            prevShipment.current = newStatus;
            toast.success(`${t("shipment.notified")}: ${t(`shipment.${newStatus}` as never)}`);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, user, t]);

  if (!order) {
    return (
      <PublicLayout>
        <div className="max-w-3xl mx-auto px-4 py-20 text-muted-foreground">{t("common.loading")}</div>
      </PublicLayout>
    );
  }

  const a = order.shipping_address;
  const subtotal = Number(order.subtotal ?? 0);
  const shipping = Number(order.shipping ?? 0);
  const tax = Number(order.tax ?? 0);
  const total = Number(order.total ?? 0);
  const isPaid = order.status === "paid" || !!order.paid_at;

  const handleDownload = () => downloadInvoicePdf(order, items, company);

  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link to="/orders" className="text-sm text-muted-foreground hover:text-foreground">
          ← {t("orders.title")}
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3 mt-3 mb-2">
          <div>
            <h1 className="font-display text-3xl font-semibold">
              {company.name || t("orders.order")}
            </h1>
            <div className="text-sm text-muted-foreground">
              {company.address ? <>{company.address}<br /></> : null}
              {company.email}{company.email && company.phone ? " · " : ""}{company.phone}
              {company.tax_id ? <><br />Tax ID: {company.tax_id}</> : null}
            </div>
          </div>
          <Button onClick={handleDownload} variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Download PDF
          </Button>
        </div>

        {/* Invoice meta block */}
        <div className="mt-4 grid sm:grid-cols-3 gap-3">
          <div className="border rounded-lg p-4 bg-card">
            <div className="text-xs uppercase text-muted-foreground mb-1">Invoice #</div>
            <div className="font-semibold">{order.invoice_number || order.id.slice(0, 8).toUpperCase()}</div>
          </div>
          <div className="border rounded-lg p-4 bg-card">
            <div className="text-xs uppercase text-muted-foreground mb-1">Date</div>
            <div className="font-semibold">{new Date(order.created_at).toLocaleDateString()}</div>
          </div>
          <div className="border rounded-lg p-4 bg-card">
            <div className="text-xs uppercase text-muted-foreground mb-1">{t("orders.status")}</div>
            <div className={`font-semibold capitalize ${isPaid ? "text-green-600" : ""}`}>{order.status}</div>
          </div>
        </div>

        <ShipmentTimeline order={order} t={t as (k: string) => string} />

        <div className="mt-4 grid sm:grid-cols-2 gap-3">
          {a && (
            <div className="border rounded-lg p-4 bg-card">
              <div className="text-xs uppercase text-muted-foreground mb-1">Bill to</div>
              <div className="text-sm">
                <div className="font-medium">{a.full_name}</div>
                <div className="text-muted-foreground">
                  {a.phone}<br />
                  {a.address}, {a.city} {a.zip}<br />
                  {a.country}
                </div>
              </div>
            </div>
          )}
          <div className="border rounded-lg p-4 bg-card">
            <div className="text-xs uppercase text-muted-foreground mb-1">{t("checkout.payment")}</div>
            <div className="font-semibold">{order.payment_method ?? "—"}</div>
            {order.paypal_capture_id && (
              <div className="text-xs text-muted-foreground mt-1 break-all">
                PayPal capture: {order.paypal_capture_id}
              </div>
            )}
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-card mt-4">
          <h3 className="font-semibold mb-3">Items</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2">Item</th>
                  <th className="text-left py-2">Variant</th>
                  <th className="text-right py-2 w-16">Qty</th>
                  <th className="text-right py-2 w-24">Unit</th>
                  <th className="text-right py-2 w-28">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-b last:border-b-0">
                    <td className="py-2">{i.name}</td>
                    <td className="py-2 text-muted-foreground">{[i.size, i.color].filter(Boolean).join(" / ") || "—"}</td>
                    <td className="py-2 text-right">{i.qty}</td>
                    <td className="py-2 text-right">${Number(i.price).toFixed(2)}</td>
                    <td className="py-2 text-right font-medium">${(i.qty * Number(i.price)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t mt-4 pt-4 space-y-1 text-sm max-w-xs ml-auto">
            <div className="flex justify-between"><span>{t("cart.subtotal")}</span><span>${subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>{t("cart.shipping")}</span><span>${shipping.toFixed(2)}</span></div>
            {tax > 0 && <div className="flex justify-between"><span>Tax</span><span>${tax.toFixed(2)}</span></div>}
            <div className="flex justify-between font-semibold text-base pt-2 border-t mt-2">
              <span>{t("cart.total")}</span><span>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {order.notes && (
          <div className="border rounded-lg p-4 bg-card mt-4 text-sm">
            <div className="text-xs uppercase text-muted-foreground mb-1">Notes</div>
            {order.notes}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}

const STEP_ICONS = {
  preparing: Package,
  awaiting_shipment: Clock,
  in_transit: Truck,
  delivered: CheckCircle2,
} as const;

function ShipmentTimeline({ order, t }: { order: Order; t: (k: string) => string }) {
  const current = (order.shipment_status as ShipmentStatus) ?? "preparing";
  const currentIdx = SHIPMENT_STEPS.indexOf(current);
  return (
    <div className="mt-4 border rounded-lg p-5 bg-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Truck className="h-4 w-4" /> {t("shipment.title")}
        </h3>
        {order.shipment_updated_at && (
          <span className="text-xs text-muted-foreground">
            {t("shipment.lastUpdate")}: {new Date(order.shipment_updated_at).toLocaleString()}
          </span>
        )}
      </div>

      <ol className="grid grid-cols-4 gap-2">
        {SHIPMENT_STEPS.map((step, idx) => {
          const Icon = STEP_ICONS[step];
          const reached = idx <= currentIdx;
          const active = idx === currentIdx;
          return (
            <li key={step} className="flex flex-col items-center text-center">
              <div className="relative w-full flex items-center justify-center">
                {idx > 0 && (
                  <span
                    className={`absolute start-0 end-1/2 top-1/2 -translate-y-1/2 h-0.5 ${
                      idx <= currentIdx ? "bg-primary" : "bg-border"
                    }`}
                  />
                )}
                {idx < SHIPMENT_STEPS.length - 1 && (
                  <span
                    className={`absolute start-1/2 end-0 top-1/2 -translate-y-1/2 h-0.5 ${
                      idx < currentIdx ? "bg-primary" : "bg-border"
                    }`}
                  />
                )}
                <span
                  className={`relative z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors ${
                    reached ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground"
                  } ${active ? "ring-2 ring-primary/30 ring-offset-2 ring-offset-background" : ""}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <span className={`mt-2 text-[11px] sm:text-xs font-medium ${reached ? "text-foreground" : "text-muted-foreground"}`}>
                {t(`shipment.${step}`)}
              </span>
            </li>
          );
        })}
      </ol>

      {(order.tracking_number || order.tracking_url) && (
        <div className="mt-4 pt-4 border-t flex flex-wrap items-center gap-3 text-sm">
          {order.tracking_number && (
            <div>
              <span className="text-muted-foreground">{t("shipment.tracking")}: </span>
              <span className="font-mono">{order.tracking_number}</span>
            </div>
          )}
          {order.tracking_url && (
            <a
              href={order.tracking_url}
              target="_blank"
              rel="noreferrer"
              className="ms-auto inline-flex items-center gap-1 text-primary hover:underline"
            >
              {t("shipment.openTracking")} →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
