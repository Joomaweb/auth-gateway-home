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
import { useRealtime } from "@/hooks/use-realtime";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
});

type PayPalCfg = { enabled: boolean; client_id: string; mode: "sandbox" | "live" };
type SquareCfg = { enabled: boolean; application_id: string; location_id: string; mode: "sandbox" | "production" };
type PaymentMethod = { name: string; enabled: boolean };
type ShippingMethod = { name: string; price: number; eta?: string };
type AddressForm = { address?: string; city?: string; zip?: string; country?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function paypalFrom(value: unknown): PayPalCfg {
  if (!isRecord(value)) return { enabled: false, client_id: "", mode: "sandbox" };
  return {
    enabled: Boolean(value.enabled),
    client_id: String(value.client_id ?? ""),
    mode: value.mode === "live" ? "live" : "sandbox",
  };
}

function squareFrom(value: unknown): SquareCfg {
  if (!isRecord(value)) return { enabled: false, application_id: "", location_id: "", mode: "sandbox" };
  return {
    enabled: Boolean(value.enabled),
    application_id: String(value.application_id ?? ""),
    location_id: String(value.location_id ?? ""),
    mode: value.mode === "production" ? "production" : "sandbox",
  };
}

function paymentMethodsFrom(value: unknown): PaymentMethod[] {
  const fallback = [{ name: "Cash on Delivery", enabled: true }];
  if (!Array.isArray(value)) return fallback;
  const methods = value
    .filter(isRecord)
    .map((m) => ({ name: String(m.name ?? ""), enabled: Boolean(m.enabled ?? true) }))
    .filter((m) => m.name.trim());
  return methods.length ? methods : fallback;
}

function shippingMethodsFrom(zonesValue: unknown, shippingValue: unknown): ShippingMethod[] {
  const zones = Array.isArray(zonesValue) ? zonesValue.filter(isRecord) : [];
  if (zones.length > 0) return zones.map((z) => ({ name: String(z.name ?? ""), price: Number(z.price ?? 0), eta: z.eta == null ? undefined : String(z.eta) }));
  const methods = Array.isArray(shippingValue) ? shippingValue.filter(isRecord) : [];
  if (methods.length > 0) return methods.map((m) => ({ name: String(m.name ?? ""), price: Number(m.price ?? 0) }));
  return [{ name: "Standard", price: 5.99 }];
}

function addressFrom(value: unknown): AddressForm {
  if (!isRecord(value)) return {};
  return {
    address: typeof value.address === "string" ? value.address : "",
    city: typeof value.city === "string" ? value.city : "",
    zip: typeof value.zip === "string" ? value.zip : "",
    country: typeof value.country === "string" ? value.country : "",
  };
}

function CheckoutPage() {
  const { t } = useT();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const subtotal = items.reduce((n, i) => n + i.qty * i.price, 0);

  const [settings, setSettings] = useState<{
    shipping_methods: ShippingMethod[];
    payment_methods: PaymentMethod[];
    free_shipping_threshold: number | null;
    paypal: PayPalCfg;
    square: SquareCfg;
    tax_rate: number;
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
    email: "",
    password: "",
  });
  const [shippingIdx, setShippingIdx] = useState(0);
  const [payment, setPayment] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const applyStoreSettings = (data: any) => {
    if (!data) return;
    const paypal = paypalFrom(data.paypal);
    const square = squareFrom(data.square);
    const baseMethods = paymentMethodsFrom(data.payment_methods);
    let methods = baseMethods;
    if (square.enabled && square.application_id && square.location_id) {
      methods = [{ name: "Square", enabled: true }, ...methods.filter((m) => m.name !== "Square")];
    }
    if (paypal.enabled && paypal.client_id) {
      methods = [{ name: "PayPal", enabled: true }, ...methods.filter((m) => m.name !== "PayPal")];
    }
    const shippingMethods = shippingMethodsFrom(data.shipping_zones, data.shipping_methods);
    setSettings({
      shipping_methods: shippingMethods,
      payment_methods: methods,
      free_shipping_threshold: data.free_shipping_threshold,
      paypal,
      square,
    });
    setPayment((current) => {
      if (current && methods.some((m) => m.enabled && m.name === current)) return current;
      return methods.find((m) => m.enabled)?.name ?? "";
    });
  };

  const loadStoreSettings = () => {
    supabase.from("store_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => applyStoreSettings(data));
  };

  const loadNeedsApproval = () => {
    if (items.length === 0) { setNeedsApproval(false); return; }
    const ids = [...new Set(items.map((i) => i.productId))];
    supabase.from("products").select("id,requires_stock_approval").in("id", ids).then(({ data }) => {
      setNeedsApproval(!!data?.some((p: { requires_stock_approval?: boolean }) => p.requires_stock_approval));
    });
  };

  // Guest checkout: no redirect to /login. Account is created inline at order time.

  useEffect(() => {
    loadStoreSettings();
    if (user) {
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
        if (data) {
          const address = addressFrom(data.address);
          setForm((f) => ({
            ...f,
            full_name: data.full_name ?? "",
            phone: data.phone ?? "",
            address: address.address ?? "",
            city: address.city ?? "",
            zip: address.zip ?? "",
            country: address.country ?? "",
          }));
        }
      });
    }
  }, [user]);

  // Check if any product in cart requires stock approval
  useEffect(() => {
    loadNeedsApproval();
  }, [items]);
  useRealtime("store_settings", loadStoreSettings, "id=eq.1");
  useRealtime(items.length ? "products" : "", loadNeedsApproval);


  const shippingMethod = settings?.shipping_methods?.[shippingIdx];
  const shippingFee =
    settings?.free_shipping_threshold != null && subtotal >= settings.free_shipping_threshold
      ? 0
      : shippingMethod?.price ?? 0;
  const total = subtotal + shippingFee;

  const requiredFieldsValid = !!(form.full_name && form.phone && form.address && form.city && form.zip && form.country);
  const guestFieldsValid = !!user || (form.email.trim().length > 3 && form.password.length >= 6);

  // Ensures we have an authenticated user before persisting the order.
  // For guests: signs them up with email/password (session is auto-persisted in localStorage).
  // If the email already exists, we try signing in with the provided password.
  const ensureAccount = async (): Promise<{ id: string }> => {
    if (user) return { id: user.id };
    const email = form.email.trim().toLowerCase();
    const password = form.password;
    if (!email || password.length < 6) {
      throw new Error("Email and password (min 6 characters) are required to create an account");
    }
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: form.full_name, phone: form.phone },
      },
    });
    if (signUpError) {
      // If user exists, try to sign in instead
      const msg = signUpError.message.toLowerCase();
      if (msg.includes("registered") || msg.includes("exists") || msg.includes("already")) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError || !signInData.user) {
          throw new Error("An account with this email already exists — incorrect password. Try signing in.");
        }
        return { id: signInData.user.id };
      }
      throw signUpError;
    }
    if (!signUpData.user) throw new Error("Failed to create account");
    // If session not auto-created (email confirmation enabled), try password sign-in.
    if (!signUpData.session) {
      const { data: signInData } = await supabase.auth.signInWithPassword({ email, password });
      if (signInData.user) return { id: signInData.user.id };
    }
    return { id: signUpData.user.id };
  };

  const persistOrder = async (
    userId: string,
    paid: boolean,
    paypalIds?: { order_id: string; capture_id: string },
  ) => {
    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        status: paid ? "paid" : (needsApproval ? "awaiting_stock" : "pending"),
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
    if (items.length === 0) return;
    if (!requiredFieldsValid) {
      toast.error("Please fill in all shipping fields");
      return;
    }
    if (!guestFieldsValid) {
      toast.error("Email and password are required to create an account");
      return;
    }
    setBusy(true);
    try {
      const acct = await ensureAccount();
      // Free orders are auto-marked as paid (used for checkout flow testing).
      const id = await persistOrder(acct.id, total === 0);
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
    if (items.length === 0) return;
    if (!requiredFieldsValid) {
      toast.error("Please fill in all shipping fields before paying");
      return;
    }
    try {
      const acct = await ensureAccount();
      const id = await persistOrder(acct.id, true, { order_id: orderId, capture_id: captureId });
      clear();
      toast.success("Payment successful");
      navigate({ to: "/orders/$id", params: { id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save order");
    }
  };

  const chargeSquare = useServerFn(chargeSquarePayment);

  const handleSquareTokenized = async (sourceId: string, verificationToken?: string) => {
    if (items.length === 0) return;
    if (!requiredFieldsValid) {
      toast.error("Please fill in all shipping fields before paying");
      return;
    }
    if (!settings?.square) return;
    setBusy(true);
    let orderId: string | null = null;
    try {
      const acct = await ensureAccount();
      // 1) Create the pending order in Supabase first (so failures are still tracked).
      orderId = await persistOrder(acct.id, false);
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
            {!user && (
              <section className="border rounded-lg p-6 bg-card">
                <h2 className="font-semibold mb-1">Quick account creation</h2>
                <p className="text-xs text-muted-foreground mb-4">
                  So we can track your order, an account will be created for you automatically. Already registered?{" "}
                  <button type="button" className="text-primary underline" onClick={() => navigate({ to: "/login" })}>
                    Sign in
                  </button>
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Email"
                    type="email"
                    value={form.email}
                    onChange={(v) => setForm({ ...form, email: v })}
                    required
                  />
                  <Field
                    label="Password (min 6 characters)"
                    type="password"
                    value={form.password}
                    onChange={(v) => setForm({ ...form, password: v })}
                    required
                  />
                </div>
              </section>
            )}
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
                      <span className="flex flex-col">
                        <span className="flex items-center gap-3">
                          <input type="radio" name="shipping" checked={shippingIdx === i} onChange={() => setShippingIdx(i)} />
                          <span className="font-medium">{m.name}</span>
                        </span>
                        {m.eta && <span className="text-xs text-muted-foreground ms-6">Delivery time: {m.eta}</span>}
                      </span>
                      <span className="text-sm font-medium">${m.price.toFixed(2)}</span>
                    </label>
                  ))}
                </div>
              )}
              {needsApproval && (
                <div className="mt-5 border border-amber-500/40 bg-amber-500/10 rounded-lg p-3 text-sm">
                  <strong>Note:</strong> One or more items in your cart require <strong>stock approval from the store</strong> before checkout can be completed. The order will be saved as "awaiting stock approval" and will only be processed after confirmation.
                </div>
              )}
            </section>

            <section className="border rounded-lg p-6 bg-card">
              <h2 className="font-semibold mb-4">{t("checkout.payment")}</h2>

              {total === 0 ? (
                <div className="border border-gold/40 bg-gold/10 rounded-lg p-4 text-sm space-y-2">
                  <p className="font-semibold">🆓 Free order</p>
                  <p className="text-muted-foreground">Order total is $0 — no payment required. The order will be created directly to test the checkout flow.</p>
                </div>
              ) : (
                <>
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
                        disabled={!requiredFieldsValid || !guestFieldsValid || busy}
                        onApproved={handlePayPalApproved}
                      />
                      {(!requiredFieldsValid || !guestFieldsValid) && (
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
                        disabled={!requiredFieldsValid || !guestFieldsValid || busy}
                        onTokenized={handleSquareTokenized}
                      />
                      {(!requiredFieldsValid || !guestFieldsValid) && (
                        <p className="text-xs text-destructive">Fill in your shipping details above to enable payment.</p>
                      )}
                    </div>
                  )}
                </>
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
            {total === 0 ? (
              <Button type="submit" className="w-full" size="lg" disabled={busy}>
                {busy ? t("common.loading") : "Complete free order"}
              </Button>
            ) : (!isPayPal && !isSquare) && (
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

function Field({ label, value, onChange, required, type }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} />
    </div>
  );
}

