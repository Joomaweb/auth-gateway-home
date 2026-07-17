import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { useRealtime } from "@/hooks/use-realtime";
import { Button } from "@/components/ui/button";
import { Download, ShoppingCart, Users, Package, TrendingUp, RefreshCw, Radio, Mail } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/reports")({
  component: AdminReports,
});

type Order = {
  id: string;
  user_id: string;
  status: string;
  total: number;
  subtotal: number | null;
  shipping: number | null;
  tax: number | null;
  discount: number | null;
  payment_method: string | null;
  invoice_number: string | null;
  shipment_status: string | null;
  tracking_number: string | null;
  created_at: string;
  shipping_address: Record<string, unknown> | null;
};
type OrderItem = {
  order_id: string;
  product_id: string | null;
  name: string;
  qty: number;
  price: number;
  variant: string | null;
};
type Product = {
  id: string;
  name: string;
  slug: string | null;
  sku: string | null;
  price: number;
  compare_at_price: number | null;
  stock: number | null;
  category_id: string | null;
  active: boolean | null;
  created_at: string;
};
type Category = { id: string; name: string; slug: string | null };
type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  address: { city?: string; country?: string; street?: string; zip?: string } | null;
  created_at: string;
};
type BannerSub = { id: string; email: string; coupon_code: string | null; source: string | null; created_at: string };

function fmtDate(v: string | null | undefined) {
  if (!v) return "";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "" : d.toISOString().replace("T", " ").slice(0, 19);
}

function autoSizeCols(rows: Record<string, unknown>[]): { wch: number }[] {
  if (!rows.length) return [];
  const keys = Object.keys(rows[0]);
  return keys.map((k) => {
    const max = Math.max(
      k.length,
      ...rows.map((r) => String(r[k] ?? "").length),
    );
    return { wch: Math.min(Math.max(max + 2, 10), 40) };
  });
}

function styleHeader(ws: XLSX.WorkSheet) {
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    const cell = ws[addr];
    if (cell) cell.s = { font: { bold: true } };
  }
}

function addSheet(wb: XLSX.WorkBook, name: string, rows: Record<string, unknown>[]) {
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = autoSizeCols(rows);
  ws["!autofilter"] = { ref: ws["!ref"] || "A1" };
  styleHeader(ws);
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
}

function download(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename, { bookType: "xlsx", compression: true });
}

function AdminReports() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [subscribers, setSubscribers] = useState<BannerSub[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const load = async () => {
    const [o, oi, p, c, pr] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("order_items").select("*"),
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("categories").select("id,name,slug"),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    ]);
    setOrders((o.data ?? []) as Order[]);
    setItems((oi.data ?? []) as OrderItem[]);
    setProducts((p.data ?? []) as Product[]);
    setCategories((c.data ?? []) as Category[]);
    setProfiles((pr.data ?? []) as Profile[]);
    setLoading(false);
    setLastSync(new Date());
  };

  useEffect(() => {
    load();
  }, []);
  useRealtime("orders", load);
  useRealtime("order_items", load);
  useRealtime("products", load);
  useRealtime("profiles", load);

  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name])), [categories]);
  const profMap = useMemo(() => Object.fromEntries(profiles.map((p) => [p.id, p])), [profiles]);
  const itemsByOrder = useMemo(() => {
    const m: Record<string, OrderItem[]> = {};
    for (const it of items) (m[it.order_id] ||= []).push(it);
    return m;
  }, [items]);

  const stats = useMemo(() => {
    const paid = orders.filter((o) => ["paid", "shipped", "delivered"].includes(o.status));
    const revenue = paid.reduce((s, o) => s + Number(o.total || 0), 0);
    const unitsSold: Record<string, number> = {};
    for (const it of items) {
      if (!it.product_id) continue;
      unitsSold[it.product_id] = (unitsSold[it.product_id] || 0) + Number(it.qty || 0);
    }
    return { revenue, orderCount: orders.length, paidCount: paid.length, unitsSold };
  }, [orders, items]);

  const exportSales = () => {
    const wb = XLSX.utils.book_new();
    const summaryRows = [
      { Metric: "Total Orders", Value: orders.length },
      { Metric: "Paid / Fulfilled Orders", Value: stats.paidCount },
      { Metric: "Total Revenue (Paid)", Value: Number(stats.revenue.toFixed(2)) },
      { Metric: "Average Order Value", Value: stats.paidCount ? Number((stats.revenue / stats.paidCount).toFixed(2)) : 0 },
      { Metric: "Report Generated At", Value: fmtDate(new Date().toISOString()) },
    ];
    addSheet(wb, "Summary", summaryRows);

    const orderRows = orders.map((o) => {
      const addr = (o.shipping_address ?? {}) as Record<string, string>;
      const prof = profMap[o.user_id];
      return {
        "Invoice #": o.invoice_number || o.id.slice(0, 8).toUpperCase(),
        "Order ID": o.id,
        Date: fmtDate(o.created_at),
        Status: o.status,
        "Shipment Status": o.shipment_status || "",
        Customer: addr.full_name || prof?.full_name || "",
        Email: prof?.email || "",
        Phone: prof?.phone || addr.phone || "",
        City: addr.city || "",
        Country: addr.country || "",
        "Payment Method": o.payment_method || "",
        Subtotal: Number(o.subtotal || 0),
        Shipping: Number(o.shipping || 0),
        Tax: Number(o.tax || 0),
        Discount: Number(o.discount || 0),
        Total: Number(o.total || 0),
        Items: (itemsByOrder[o.id] || []).reduce((n, i) => n + Number(i.qty || 0), 0),
        "Tracking #": o.tracking_number || "",
      };
    });
    addSheet(wb, "Orders", orderRows);

    const lineRows = items.map((it) => {
      const o = orders.find((x) => x.id === it.order_id);
      return {
        "Order ID": it.order_id,
        "Invoice #": o?.invoice_number || (o ? o.id.slice(0, 8).toUpperCase() : ""),
        Date: fmtDate(o?.created_at),
        Status: o?.status || "",
        Product: it.name,
        "Product ID": it.product_id || "",
        Variant: it.variant || "",
        Qty: Number(it.qty || 0),
        "Unit Price": Number(it.price || 0),
        "Line Total": Number(it.qty || 0) * Number(it.price || 0),
      };
    });
    addSheet(wb, "Line Items", lineRows);

    // Daily breakdown
    const byDay: Record<string, { orders: number; revenue: number }> = {};
    for (const o of orders) {
      const d = (o.created_at || "").slice(0, 10);
      if (!d) continue;
      byDay[d] ||= { orders: 0, revenue: 0 };
      byDay[d].orders++;
      if (["paid", "shipped", "delivered"].includes(o.status)) byDay[d].revenue += Number(o.total || 0);
    }
    const dailyRows = Object.entries(byDay)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, v]) => ({ Date: date, Orders: v.orders, Revenue: Number(v.revenue.toFixed(2)) }));
    addSheet(wb, "Daily Sales", dailyRows);

    download(wb, `sales-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Sales report exported");
  };

  const exportCustomers = () => {
    const wb = XLSX.utils.book_new();
    const spendByUser: Record<string, { orders: number; total: number; last: string }> = {};
    for (const o of orders) {
      const s = (spendByUser[o.user_id] ||= { orders: 0, total: 0, last: "" });
      s.orders++;
      if (["paid", "shipped", "delivered"].includes(o.status)) s.total += Number(o.total || 0);
      if (!s.last || o.created_at > s.last) s.last = o.created_at;
    }
    const rows = profiles.map((p) => {
      const s = spendByUser[p.id] || { orders: 0, total: 0, last: "" };
      return {
        "Customer ID": p.id,
        "Full Name": p.full_name || "",
        Email: p.email || "",
        Phone: p.phone || "",
        City: p.address?.city || "",
        Country: p.address?.country || "",
        Street: p.address?.street || "",
        ZIP: p.address?.zip || "",
        "Registered At": fmtDate(p.created_at),
        "Total Orders": s.orders,
        "Total Spent": Number(s.total.toFixed(2)),
        "Last Order": fmtDate(s.last),
      };
    });
    addSheet(wb, "Customers", rows);
    download(wb, `customers-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Customers report exported");
  };

  const exportProducts = () => {
    const wb = XLSX.utils.book_new();
    const revByProduct: Record<string, { units: number; revenue: number }> = {};
    for (const it of items) {
      if (!it.product_id) continue;
      const o = orders.find((x) => x.id === it.order_id);
      if (o && !["paid", "shipped", "delivered"].includes(o.status)) continue;
      const r = (revByProduct[it.product_id] ||= { units: 0, revenue: 0 });
      r.units += Number(it.qty || 0);
      r.revenue += Number(it.qty || 0) * Number(it.price || 0);
    }
    const rows = products.map((p) => {
      const r = revByProduct[p.id] || { units: 0, revenue: 0 };
      return {
        "Product ID": p.id,
        Name: p.name,
        SKU: p.sku || "",
        Slug: p.slug || "",
        Category: p.category_id ? catMap[p.category_id] || "" : "",
        Price: Number(p.price || 0),
        "Compare-at Price": Number(p.compare_at_price || 0),
        Stock: Number(p.stock ?? 0),
        Active: p.active ? "Yes" : "No",
        "Units Sold": r.units,
        "Revenue Generated": Number(r.revenue.toFixed(2)),
        "Created At": fmtDate(p.created_at),
      };
    });
    addSheet(wb, "Products", rows);

    // Top sellers sheet
    const top = [...rows]
      .sort((a, b) => Number(b["Units Sold"]) - Number(a["Units Sold"]))
      .slice(0, 50);
    addSheet(wb, "Top 50 Sellers", top);

    download(wb, `products-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Products report exported");
  };

  const exportAll = () => {
    exportSales();
    setTimeout(exportCustomers, 200);
    setTimeout(exportProducts, 400);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold flex items-center gap-2">
            <TrendingUp className="h-7 w-7 text-primary" />
            דוחות וייצוא
          </h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
            <Radio className="h-3.5 w-3.5 text-green-500 animate-pulse" />
            עדכון בזמן אמת · סנכרון אחרון: {lastSync ? lastSync.toLocaleTimeString("he-IL") : "…"}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 me-2 ${loading ? "animate-spin" : ""}`} />
            רענן
          </Button>
          <Button onClick={exportAll}>
            <Download className="h-4 w-4 me-2" />
            ייצא הכל
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-xl p-5 bg-card">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-muted-foreground">הכנסות (שולם)</div>
            <TrendingUp className="h-5 w-5 text-green-500" />
          </div>
          <div className="text-3xl font-display font-semibold">${stats.revenue.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground mt-1">{stats.paidCount} הזמנות ששולמו</div>
        </div>
        <div className="border rounded-xl p-5 bg-card">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-muted-foreground">סה״כ הזמנות</div>
            <ShoppingCart className="h-5 w-5 text-blue-500" />
          </div>
          <div className="text-3xl font-display font-semibold">{orders.length}</div>
          <div className="text-xs text-muted-foreground mt-1">כולל ממתין ובוטל</div>
        </div>
        <div className="border rounded-xl p-5 bg-card">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-muted-foreground">לקוחות רשומים</div>
            <Users className="h-5 w-5 text-purple-500" />
          </div>
          <div className="text-3xl font-display font-semibold">{profiles.length}</div>
          <div className="text-xs text-muted-foreground mt-1">{products.length} מוצרים בקטלוג</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ReportCard
          icon={<ShoppingCart className="h-6 w-6" />}
          title="דוח מכירות"
          desc="הזמנות, פריטים, פירוט יומי וסיכום הכנסות"
          sheets={["Summary", "Orders", "Line Items", "Daily Sales"]}
          onExport={exportSales}
          count={orders.length}
        />
        <ReportCard
          icon={<Users className="h-6 w-6" />}
          title="דוח לקוחות"
          desc="פרטי קשר, כתובות, סה״כ הוצאה והזמנה אחרונה"
          sheets={["Customers"]}
          onExport={exportCustomers}
          count={profiles.length}
        />
        <ReportCard
          icon={<Package className="h-6 w-6" />}
          title="דוח מוצרים"
          desc="מלאי, קטגוריות, יחידות שנמכרו וטופ 50"
          sheets={["Products", "Top 50 Sellers"]}
          onExport={exportProducts}
          count={products.length}
        />
      </div>
    </div>
  );
}

function ReportCard({
  icon,
  title,
  desc,
  sheets,
  onExport,
  count,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  sheets: string[];
  onExport: () => void;
  count: number;
}) {
  return (
    <div className="border rounded-xl p-5 bg-card flex flex-col gap-4 hover:shadow-elegant transition-shadow">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">{icon}</div>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{count} רשומות</p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{desc}</p>
      <div className="flex flex-wrap gap-1">
        {sheets.map((s) => (
          <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {s}
          </span>
        ))}
      </div>
      <Button onClick={onExport} className="w-full mt-auto">
        <Download className="h-4 w-4 me-2" />
        ייצא ל-Excel
      </Button>
    </div>
  );
}
