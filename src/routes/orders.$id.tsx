import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { downloadInvoicePdf, type Company, type InvoiceOrder, type InvoiceItem } from "@/lib/invoice-pdf";

export const Route = createFileRoute("/orders/$id")({
  component: OrderDetailPage,
});

type Order = InvoiceOrder & { user_id: string };
type Item = InvoiceItem & { id: string };

function OrderDetailPage() {
  const { id } = Route.useParams();
  const { t } = useT();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [company, setCompany] = useState<Company>({});

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("orders").select("*").eq("id", id).maybeSingle().then(({ data }) => setOrder(data as Order | null));
    supabase.from("order_items").select("*").eq("order_id", id).then(({ data }) => setItems((data ?? []) as Item[]));
    supabase.from("store_settings").select("company").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data?.company) setCompany(data.company as Company);
    });
  }, [id, user]);

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
