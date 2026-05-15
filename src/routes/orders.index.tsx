import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { useRealtime } from "@/hooks/use-realtime";
import {
  Package, Clock, Truck, CheckCircle2, XCircle, AlertTriangle,
  ChevronLeft, Receipt, ShoppingBag,
} from "lucide-react";

export const Route = createFileRoute("/orders/")({
  component: OrdersPage,
});

type Order = {
  id: string;
  status: string;
  total: number;
  created_at: string;
  shipment_status: string | null;
  payment_method: string | null;
  invoice_number: string | null;
};

type ItemPreview = {
  order_id: string;
  name: string;
  qty: number;
  product_id: string | null;
};

type ProductImage = { id: string; images: string[] | null };

const STATUS_STYLES: Record<string, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  paid:           { label: "שולם",       cls: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30",   Icon: CheckCircle2 },
  pending:        { label: "ממתין",      cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",   Icon: Clock },
  awaiting_stock: { label: "אישור מלאי", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",   Icon: AlertTriangle },
  shipped:        { label: "נשלח",       cls: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",       Icon: Truck },
  delivered:      { label: "נמסר",       cls: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30",   Icon: Package },
  failed:         { label: "נכשל",       cls: "bg-destructive/15 text-destructive border-destructive/30",                  Icon: XCircle },
  cancelled:      { label: "בוטל",       cls: "bg-muted text-muted-foreground border-border",                              Icon: XCircle },
};

function statusInfo(s: string) {
  return STATUS_STYLES[s] ?? { label: s, cls: "bg-muted text-muted-foreground border-border", Icon: Package };
}

function OrdersPage() {
  const { t } = useT();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, ItemPreview[]>>({});
  const [thumbsByProduct, setThumbsByProduct] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const load = async () => {
    if (!user) return;
    const { data: ords } = await supabase
      .from("orders")
      .select("id,status,total,created_at,shipment_status,payment_method,invoice_number")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    const list = (ords ?? []) as Order[];
    setOrders(list);

    if (list.length === 0) return;
    const ids = list.map((o) => o.id);
    const { data: its } = await supabase
      .from("order_items")
      .select("order_id,name,qty,product_id")
      .in("order_id", ids);
    const grouped: Record<string, ItemPreview[]> = {};
    for (const it of (its ?? []) as ItemPreview[]) {
      (grouped[it.order_id] ||= []).push(it);
    }
    setItemsByOrder(grouped);

    const productIds = Array.from(new Set(((its ?? []) as ItemPreview[]).map((i) => i.product_id).filter(Boolean))) as string[];
    if (productIds.length) {
      const { data: prods } = await supabase
        .from("products")
        .select("id,images")
        .in("id", productIds);
      const map: Record<string, string> = {};
      for (const p of (prods ?? []) as ProductImage[]) {
        if (p.images?.[0]) map[p.id] = p.images[0];
      }
      setThumbsByProduct(map);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user]);
  useRealtime("orders", load, user ? `user_id=eq.${user.id}` : undefined);

  if (!user) return null;

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 py-10 md:py-14">
        <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight">{t("orders.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {orders.length > 0
                ? `${orders.length} ${orders.length === 1 ? "הזמנה" : "הזמנות"}`
                : t("orders.empty")}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/shop"><ShoppingBag className="h-4 w-4 me-2" /> {t("nav.shop")}</Link>
          </Button>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed rounded-2xl bg-card/40">
            <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-6">{t("orders.empty")}</p>
            <Button asChild size="lg"><Link to="/shop">{t("nav.shop")}</Link></Button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((o) => {
              const items = itemsByOrder[o.id] ?? [];
              const totalQty = items.reduce((n, i) => n + Number(i.qty || 0), 0);
              const itemSummary = items.slice(0, 2).map((i) => i.name).join(", ");
              const more = items.length > 2 ? ` +${items.length - 2}` : "";
              const s = statusInfo(o.status);
              const StatusIcon = s.Icon;
              const date = new Date(o.created_at);
              return (
                <Link
                  key={o.id}
                  to="/orders/$id"
                  params={{ id: o.id }}
                  className="group relative block rounded-2xl border bg-card hover:shadow-elegant hover:border-primary/40 transition-all overflow-hidden"
                >
                  <div className="p-5 md:p-6 flex flex-col md:flex-row gap-5">
                    {/* Thumbnails */}
                    <div className="flex -space-x-3 rtl:space-x-reverse flex-shrink-0">
                      {(items.length ? items.slice(0, 3) : [null, null, null]).map((it, idx) => {
                        const src = it?.product_id ? thumbsByProduct[it.product_id] : null;
                        return (
                          <div
                            key={idx}
                            className="w-16 h-16 md:w-20 md:h-20 rounded-xl border-2 border-background bg-muted overflow-hidden flex items-center justify-center"
                          >
                            {src ? (
                              <img src={src} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Package className="h-6 w-6 text-muted-foreground/40" />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Body */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-display text-lg font-semibold">
                              {o.invoice_number ? `#${o.invoice_number}` : `#${o.id.slice(0, 8).toUpperCase()}`}
                            </span>
                            <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${s.cls}`}>
                              <StatusIcon className="h-3 w-3" /> {s.label}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {date.toLocaleDateString("he-IL", { day: "2-digit", month: "short", year: "numeric" })}
                            {" · "}
                            {date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                            {o.payment_method ? ` · ${o.payment_method}` : ""}
                          </div>
                        </div>
                        <div className="text-end">
                          <div className="font-display text-2xl font-semibold text-gradient-gold">
                            ${Number(o.total).toFixed(2)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {totalQty} {totalQty === 1 ? "פריט" : "פריטים"}
                          </div>
                        </div>
                      </div>

                      {itemSummary && (
                        <p className="text-sm text-muted-foreground mt-3 line-clamp-1">
                          {itemSummary}{more}
                        </p>
                      )}

                      <div className="mt-4 pt-4 border-t border-dashed flex items-center justify-between gap-3">
                        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                          <Receipt className="h-3.5 w-3.5" />
                          לחץ לצפייה בקבלה ובפרטים המלאים
                        </span>
                        <span className="text-sm font-medium text-primary inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                          פרטים <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
