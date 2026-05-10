import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCart } from "@/lib/cart";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
});

function CheckoutPage() {
  const { t } = useT();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const subtotal = items.reduce((n, i) => n + i.qty * i.price, 0);

  const [settings, setSettings] = useState<{
    shipping_methods: { name: string; price: number }[];
    payment_methods: { name: string; enabled: boolean }[];
    free_shipping_threshold: number | null;
  } | null>(null);

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    address: "",
    city: "",
    zip: "",
    country: "",
    notes: "",
  });
  const [shippingIdx, setShippingIdx] = useState(0);
  const [payment, setPayment] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  useEffect(() => {
    supabase.from("store_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) {
        setSettings({
          shipping_methods: data.shipping_methods ?? [{ name: "Standard", price: 5.99 }],
          payment_methods: data.payment_methods ?? [{ name: "Cash on Delivery", enabled: true }],
          free_shipping_threshold: data.free_shipping_threshold,
        });
        const enabled = (data.payment_methods ?? []).find((m: { enabled: boolean }) => m.enabled);
        if (enabled) setPayment(enabled.name);
      }
    });
    if (user) {
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
        if (data) {
          setForm((f) => ({
            ...f,
            full_name: data.full_name ?? "",
            phone: data.phone ?? "",
            address: data.address?.address ?? "",
            city: data.address?.city ?? "",
            zip: data.address?.zip ?? "",
            country: data.address?.country ?? "",
          }));
        }
      });
    }
  }, [user]);

  const shippingMethod = settings?.shipping_methods?.[shippingIdx];
  const shippingFee =
    settings?.free_shipping_threshold != null && subtotal >= settings.free_shipping_threshold
      ? 0
      : shippingMethod?.price ?? 0;
  const total = subtotal + shippingFee;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || items.length === 0) return;
    setBusy(true);
    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        status: "pending",
        subtotal,
        shipping: shippingFee,
        total,
        shipping_address: {
          full_name: form.full_name,
          phone: form.phone,
          address: form.address,
          city: form.city,
          zip: form.zip,
          country: form.country,
          method: shippingMethod?.name,
        },
        payment_method: payment,
        notes: form.notes,
      })
      .select()
      .single();
    if (error || !order) {
      setBusy(false);
      toast.error(error?.message ?? "Failed to place order");
      return;
    }
    const itemsRows = items.map((i) => ({
      order_id: order.id,
      product_id: i.productId,
      variant_id: i.variantId,
      name: i.name,
      size: i.size,
      color: i.color,
      qty: i.qty,
      price: i.price,
    }));
    await supabase.from("order_items").insert(itemsRows);
    clear();
    setBusy(false);
    toast.success(t("checkout.success"));
    navigate({ to: "/orders/$id", params: { id: order.id } });
  };

  if (items.length === 0) {
    return (
      <PublicLayout>
        <div className="max-w-3xl mx-auto px-4 py-20 text-center text-muted-foreground">
          {t("cart.empty")}
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="font-display text-4xl font-semibold mb-8">{t("checkout.title")}</h1>
        <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <section className="border rounded-lg p-6 bg-card">
              <h2 className="font-semibold mb-4">{t("checkout.shipping")}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("checkout.fullName")} value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} required />
                <Field label={t("checkout.phone")} value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} required />
                <div className="sm:col-span-2">
                  <Field label={t("checkout.address")} value={form.address} onChange={(v) => setForm({ ...form, address: v })} required />
                </div>
                <Field label={t("checkout.city")} value={form.city} onChange={(v) => setForm({ ...form, city: v })} required />
                <Field label={t("checkout.zip")} value={form.zip} onChange={(v) => setForm({ ...form, zip: v })} required />
                <div className="sm:col-span-2">
                  <Field label={t("checkout.country")} value={form.country} onChange={(v) => setForm({ ...form, country: v })} required />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label>{t("checkout.notes")}</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>

              {settings && settings.shipping_methods.length > 0 && (
                <div className="mt-6 space-y-2">
                  <Label>{t("cart.shipping")}</Label>
                  {settings.shipping_methods.map((m, i) => (
                    <label key={i} className="flex items-center justify-between border rounded p-3 cursor-pointer hover:bg-muted/50">
                      <span className="flex items-center gap-3">
                        <input type="radio" name="shipping" checked={shippingIdx === i} onChange={() => setShippingIdx(i)} />
                        {m.name}
                      </span>
                      <span className="text-sm font-medium">${m.price.toFixed(2)}</span>
                    </label>
                  ))}
                </div>
              )}
            </section>

            <section className="border rounded-lg p-6 bg-card">
              <h2 className="font-semibold mb-4">{t("checkout.payment")}</h2>
              <div className="space-y-2">
                {settings?.payment_methods?.filter((m) => m.enabled).map((m) => (
                  <label key={m.name} className="flex items-center gap-3 border rounded p-3 cursor-pointer hover:bg-muted/50">
                    <input type="radio" name="payment" checked={payment === m.name} onChange={() => setPayment(m.name)} />
                    {m.name}
                  </label>
                ))}
              </div>
            </section>
          </div>

          <div className="border rounded-lg p-6 bg-card h-fit sticky top-20 space-y-3">
            <h2 className="font-semibold mb-2">{t("orders.order")}</h2>
            <div className="space-y-2 text-sm max-h-64 overflow-auto">
              {items.map((i) => (
                <div key={`${i.productId}-${i.variantId}`} className="flex justify-between gap-2">
                  <span className="truncate">{i.name} × {i.qty}</span>
                  <span className="whitespace-nowrap">${(i.qty * i.price).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-3 space-y-2 text-sm">
              <div className="flex justify-between"><span>{t("cart.subtotal")}</span><span>${subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>{t("cart.shipping")}</span><span>${shippingFee.toFixed(2)}</span></div>
              <div className="flex justify-between text-base font-semibold border-t pt-2">
                <span>{t("cart.total")}</span><span>${total.toFixed(2)}</span>
              </div>
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={busy || !payment}>
              {busy ? t("common.loading") : t("checkout.placeOrder")}
            </Button>
          </div>
        </form>
      </div>
    </PublicLayout>
  );
}

function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} required={required} />
    </div>
  );
}
