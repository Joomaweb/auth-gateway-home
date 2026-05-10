import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/admin/orders/new")({
  component: NewOrder,
});

type Customer = { id: string; full_name: string | null; email: string | null };
type Product = { id: string; name: string; price: number; sale_price: number | null };
type Line = { product_id: string; name: string; price: number; qty: number; size: string; color: string };

function NewOrder() {
  const navigate = useNavigate();
  const { t } = useT();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [userId, setUserId] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [shipping, setShipping] = useState({ full_name: "", phone: "", address: "", city: "", zip: "", country: "" });
  const [shippingFee, setShippingFee] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("Cash on Delivery");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("profiles").select("id,full_name,email").then(({ data }) => setCustomers((data ?? []) as Customer[]));
    supabase.from("products").select("id,name,price,sale_price").eq("active", true).then(({ data }) => setProducts((data ?? []) as Product[]));
  }, []);

  const subtotal = lines.reduce((n, l) => n + l.qty * l.price, 0);
  const total = subtotal + shippingFee;

  const addLine = (id: string) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setLines([...lines, { product_id: p.id, name: p.name, price: p.sale_price ?? p.price, qty: 1, size: "", color: "" }]);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId || lines.length === 0) return toast.error("בחר לקוח והוסף לפחות מוצר אחד");
    if (lines.some((line) => !line.product_id || !line.name || line.qty < 1 || line.price < 0 || !Number.isFinite(line.qty) || !Number.isFinite(line.price))) {
      return toast.error("בדוק שכל פריטי ההזמנה תקינים: מוצר, כמות ומחיר");
    }
    setBusy(true);
    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        status: "pending",
        subtotal: Number(subtotal),
        shipping: Number(shippingFee),
        total: Number(total),
        shipping_address: shipping,
        payment_method: paymentMethod || null,
        notes: notes || null,
      })
      .select("id")
      .single();
    if (error || !order) { setBusy(false); toast.error(error?.message ?? "שגיאה ביצירת ההזמנה"); return; }
    const { error: itemsError } = await supabase.from("order_items").insert(lines.map((l) => ({
      order_id: order.id, product_id: l.product_id, name: l.name, size: l.size || null, color: l.color || null, qty: Number(l.qty), price: Number(l.price),
    })));
    if (itemsError) {
      await supabase.from("orders").delete().eq("id", order.id);
      setBusy(false);
      toast.error("ההזמנה לא נשמרה: " + itemsError.message);
      return;
    }
    setBusy(false);
    toast.success("ההזמנה נוצרה");
    navigate({ to: "/admin/orders/$id", params: { id: order.id } });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Link to="/admin/orders" className="text-sm text-muted-foreground hover:text-foreground">← {t("admin.orders")}</Link>
      <h1 className="font-display text-3xl font-semibold">{t("admin.newOrder")}</h1>
      <form onSubmit={submit} className="space-y-4 bg-card border rounded-lg p-6">
        <div className="space-y-2">
          <Label>Customer</Label>
          <select className="w-full border rounded-md p-2 bg-background" value={userId} onChange={(e) => {
            setUserId(e.target.value);
            const c = customers.find((x) => x.id === e.target.value);
            if (c?.full_name) setShipping((s) => ({ ...s, full_name: c.full_name ?? "" }));
          }} required>
            <option value="">—</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.full_name ?? c.email}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          <Label>Add product</Label>
          <select className="w-full border rounded-md p-2 bg-background" onChange={(e) => { if (e.target.value) { addLine(e.target.value); e.target.value = ""; } }}>
            <option value="">—</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} (${p.price})</option>)}
          </select>
        </div>

        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_70px_70px_70px_70px_auto] gap-2 items-center">
            <div className="text-sm">{l.name}</div>
            <Input placeholder="Size" value={l.size} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, size: e.target.value } : x))} />
            <Input placeholder="Color" value={l.color} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, color: e.target.value } : x))} />
            <Input type="number" min={1} value={l.qty} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, qty: Number(e.target.value) } : x))} />
            <Input type="number" step="0.01" value={l.price} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, price: Number(e.target.value) } : x))} />
            <Button type="button" size="icon" variant="ghost" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))}

        <div className="grid grid-cols-2 gap-3 border-t pt-4">
          <Field label="Address" value={shipping.address} onChange={(v) => setShipping({ ...shipping, address: v })} />
          <Field label="City" value={shipping.city} onChange={(v) => setShipping({ ...shipping, city: v })} />
          <Field label="ZIP" value={shipping.zip} onChange={(v) => setShipping({ ...shipping, zip: v })} />
          <Field label="Country" value={shipping.country} onChange={(v) => setShipping({ ...shipping, country: v })} />
          <Field label="Phone" value={shipping.phone} onChange={(v) => setShipping({ ...shipping, phone: v })} />
          <div className="space-y-2"><Label>Shipping fee</Label><Input type="number" step="0.01" value={shippingFee} onChange={(e) => setShippingFee(Number(e.target.value))} /></div>
        </div>

        <Field label="Payment method" value={paymentMethod} onChange={setPaymentMethod} />
        <div className="space-y-2"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

        <div className="border-t pt-3 text-sm space-y-1">
          <div className="flex justify-between"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Shipping</span><span>${shippingFee.toFixed(2)}</span></div>
          <div className="flex justify-between font-semibold"><span>Total</span><span>${total.toFixed(2)}</span></div>
        </div>

        <Button type="submit" disabled={busy} className="w-full"><Plus className="h-4 w-4 me-1" /> {busy ? "..." : "Create order"}</Button>
      </form>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <div className="space-y-2"><Label>{label}</Label><Input value={value} onChange={(e) => onChange(e.target.value)} /></div>;
}
