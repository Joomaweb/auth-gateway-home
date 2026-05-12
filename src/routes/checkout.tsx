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
import { PayPalCheckout } from "@/components/checkout/PayPalCheckout";
import { SquareCheckout } from "@/components/checkout/SquareCheckout";
import { useServerFn } from "@tanstack/react-start";
import { chargeSquarePayment } from "@/lib/square.functions";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
});

type PayPalCfg = { enabled: boolean; client_id: string; mode: "sandbox" | "live" };
type SquareCfg = { enabled: boolean; application_id: string; location_id: string; mode: "sandbox" | "production" };

function CheckoutPage() {
  const { t } = useT();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const subtotal = items.reduce((n, i) => n + i.qty * i.price, 0);

  const [settings, setSettings] = useState<{
    shipping_methods: { name: string; price: number; eta?: string }[];
    payment_methods: { name: string; enabled: boolean }[];
    free_shipping_threshold: number | null;
    paypal: PayPalCfg;
    square: SquareCfg;
  } | null>(null);
  const [needsApproval, setNeedsApproval] = useState(false);

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
  const [payment, setPayment] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  useEffect(() => {
    supabase.from("store_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) {
        const paypal: PayPalCfg = data.paypal ?? { enabled: false, client_id: "", mode: "sandbox" };
        const square: SquareCfg = data.square ?? { enabled: false, application_id: "", location_id: "", mode: "sandbox" };
        const baseMethods = (data.payment_methods ?? [{ name: "Cash on Delivery", enabled: true }]) as { name: string; enabled: boolean }[];
        let methods = baseMethods;
        if (square.enabled && square.application_id && square.location_id) {
          methods = [{ name: "Square", enabled: true }, ...methods.filter((m) => m.name !== "Square")];
        }
        if (paypal.enabled && paypal.client_id) {
          methods = [{ name: "PayPal", enabled: true }, ...methods.filter((m) => m.name !== "PayPal")];
        }
        const zones = Array.isArray(data.shipping_zones) ? data.shipping_zones : [];
        const shippingMethods = zones.length > 0
          ? zones.map((z: { name: string; price: number; eta?: string }) => ({ name: z.name, price: Number(z.price), eta: z.eta }))
          : (data.shipping_methods ?? [{ name: "Standard", price: 5.99 }]);
        setSettings({
          shipping_methods: shippingMethods,
          payment_methods: methods,
          free_shipping_threshold: data.free_shipping_threshold,
          paypal,
          square,
        });
        const enabled = methods.find((m) => m.enabled);
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

  const requiredFieldsValid = !!(form.full_name && form.phone && form.address && form.city && form.zip && form.country);

  const persistOrder = async (
    paid: boolean,
    paypalIds?: { order_id: string; capture_id: string },
  ) => {
    if (!user) throw new Error("Not signed in");
    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        status: paid ? "paid" : "pending",
        subtotal,
        shipping: shippingFee,
        tax: 0,
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
        paypal_order_id: paypalIds?.order_id ?? null,
        paypal_capture_id: paypalIds?.capture_id ?? null,
        paid_at: paid ? new Date().toISOString() : null,
      })
      .select()
      .single();
    if (error || !order) throw new Error(error?.message ?? "Failed to place order");
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
    return order.id as string;
  };

  const handleManualSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || items.length === 0) return;
    if (!requiredFieldsValid) {
      toast.error("Please fill in all shipping fields");
      return;
    }
    setBusy(true);
    try {
      const id = await persistOrder(false);
      clear();
      toast.success(t("checkout.success"));
      navigate({ to: "/orders/$id", params: { id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const handlePayPalApproved = async (orderId: string, captureId: string) => {
    if (!user || items.length === 0) return;
    if (!requiredFieldsValid) {
      toast.error("Please fill in all shipping fields before paying");
      return;
    }
    try {
      const id = await persistOrder(true, { order_id: orderId, capture_id: captureId });
      clear();
      toast.success("Payment successful");
      navigate({ to: "/orders/$id", params: { id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save order");
    }
  };

  const chargeSquare = useServerFn(chargeSquarePayment);

  const handleSquareTokenized = async (sourceId: string, verificationToken?: string) => {
    if (!user || items.length === 0) return;
    if (!requiredFieldsValid) {
      toast.error("Please fill in all shipping fields before paying");
      return;
    }
    if (!settings?.square) return;
    setBusy(true);
    let orderId: string | null = null;
    try {
      // 1) Create the pending order in Supabase first (so failures are still tracked).
      orderId = await persistOrder(false);
      // 2) Charge via Square server function with reference_id = order.id
      const res = await chargeSquare({
        data: {
          orderId,
          sourceId,
          verificationToken,
          amount: total,
          currency: "USD",
          mode: settings.square.mode,
        },
      });
      if (res.ok) {
        clear();
        if (res.status === "paid") toast.success("Payment successful");
        else toast.info("Payment is pending confirmation");
        navigate({ to: "/orders/$id", params: { id: orderId } });
        return;
      }
      // Failed/cancelled: keep the order, navigate to order page so user sees status + retry.
      const msg =
        res.reason === "cancelled" ? "Payment cancelled — you can try again."
        : res.reason === "card_declined" ? `Card declined: ${res.message}`
        : res.reason === "network_error" ? "Network error — please try again."
        : res.reason === "config_error" ? "Payment is not configured. Contact support."
        : res.message || "Payment failed";
      toast.error(msg);
      navigate({ to: "/orders/$id", params: { id: orderId } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Payment failed";
      toast.error(msg);
      if (orderId) navigate({ to: "/orders/$id", params: { id: orderId } });
    } finally {
      setBusy(false);
    }
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

  const isPayPal = payment === "PayPal";
  const isSquare = payment === "Square";

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="font-display text-4xl font-semibold mb-8">{t("checkout.title")}</h1>
        <form onSubmit={handleManualSubmit} className="grid gap-8 lg:grid-cols-3">
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
                    <span className="flex-1">{m.name}</span>
                    {m.name === "PayPal" && (
                      <span className="text-xs text-muted-foreground">PayPal · Credit / Debit card</span>
                    )}
                    {m.name === "Square" && (
                      <span className="text-xs text-muted-foreground">Credit / Debit card</span>
                    )}
                  </label>
                ))}
              </div>

              {isPayPal && settings?.paypal && (
                <div className="mt-5 pt-5 border-t space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Pay securely with PayPal balance, or click <strong>Debit or Credit Card</strong> to enter card details directly — no PayPal account required.
                  </p>
                  <PayPalCheckout
                    clientId={settings.paypal.client_id}
                    mode={settings.paypal.mode}
                    amount={total}
                    currency="USD"
                    disabled={!requiredFieldsValid || busy}
                    onApproved={handlePayPalApproved}
                  />
                  {!requiredFieldsValid && (
                    <p className="text-xs text-destructive">Fill in your shipping details above to enable payment.</p>
                  )}
                </div>
              )}

              {isSquare && settings?.square && (
                <div className="mt-5 pt-5 border-t space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Pay securely with your credit or debit card via Square.
                  </p>
                  <SquareCheckout
                    applicationId={settings.square.application_id}
                    locationId={settings.square.location_id}
                    mode={settings.square.mode}
                    amount={total}
                    currency="USD"
                    disabled={!requiredFieldsValid || busy}
                    onTokenized={handleSquareTokenized}
                  />
                  {!requiredFieldsValid && (
                    <p className="text-xs text-destructive">Fill in your shipping details above to enable payment.</p>
                  )}
                </div>
              )}
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
            {!isPayPal && !isSquare && (
              <Button type="submit" className="w-full" size="lg" disabled={busy || !payment}>
                {busy ? t("common.loading") : t("checkout.placeOrder")}
              </Button>
            )}
            {isPayPal && (
              <p className="text-xs text-muted-foreground text-center">
                Use the PayPal buttons to complete your payment.
              </p>
            )}
            {isSquare && (
              <p className="text-xs text-muted-foreground text-center">
                Enter your card details and press Pay above.
              </p>
            )}
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

