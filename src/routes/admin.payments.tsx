import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/use-realtime";
import { signalAppDataChanged } from "@/lib/realtime-sync";

export const Route = createFileRoute("/admin/payments")({
  component: AdminPayments,
});

type PaymentMethod = { name: string; enabled: boolean };
type PayPal = { enabled: boolean; client_id: string; mode: "sandbox" | "live" };
type Square = { enabled: boolean; application_id: string; location_id: string; mode: "sandbox" | "production" };

const DEFAULT_PAYPAL: PayPal = { enabled: false, client_id: "", mode: "sandbox" };
const DEFAULT_SQUARE: Square = { enabled: false, application_id: "", location_id: "", mode: "sandbox" };
const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [{ name: "Cash on Delivery", enabled: true }];

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function paymentMethodsFrom(value: unknown): PaymentMethod[] {
  if (!Array.isArray(value)) return DEFAULT_PAYMENT_METHODS;
  const methods = value
    .filter(isRecord)
    .map((m) => ({ name: String(m.name ?? ""), enabled: Boolean(m.enabled ?? true) }))
    .filter((m) => m.name.trim());
  return methods.length ? methods : DEFAULT_PAYMENT_METHODS;
}

function AdminPayments() {
  const [payment, setPayment] = useState<PaymentMethod[]>(DEFAULT_PAYMENT_METHODS);
  const [paypal, setPaypal] = useState<PayPal>(DEFAULT_PAYPAL);
  const [square, setSquare] = useState<Square>(DEFAULT_SQUARE);
  const [busy, setBusy] = useState(false);

  const loadPaymentSettings = () => {
    supabase.from("store_settings").select("payment_methods, paypal, square").eq("id", 1).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setPayment(paymentMethodsFrom(data.payment_methods));
        if (data.paypal) setPaypal({ ...DEFAULT_PAYPAL, ...(data.paypal as PayPal) });
        if (data.square) setSquare({ ...DEFAULT_SQUARE, ...(data.square as Square) });
      });
  };

  useEffect(() => {
    loadPaymentSettings();
  }, []);
  useRealtime("store_settings", loadPaymentSettings, "id=eq.1");

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("store_settings").upsert({
      id: 1,
      payment_methods: payment,
      paypal,
      square,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      signalAppDataChanged("store_settings");
      toast.success("Saved");
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-display text-3xl font-semibold">הגדרות תשלום</h1>
      <p className="text-sm text-muted-foreground">כל אמצעי התשלום והאינטגרציות מנוהלים כאן.</p>
      <form onSubmit={save} className="space-y-6">
        {/* Manual payment methods */}
        <section className="border rounded-lg p-6 bg-card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">אמצעי תשלום ידניים</h3>
            <Button type="button" size="sm" variant="outline" onClick={() => setPayment([...payment, { name: "", enabled: true }])}>
              <Plus className="h-3 w-3 me-1" /> הוסף
            </Button>
          </div>
          {payment.map((p, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
              <Input placeholder="שם" value={p.name} onChange={(e) => setPayment(payment.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
              <Switch checked={p.enabled} onCheckedChange={(v) => setPayment(payment.map((x, j) => j === i ? { ...x, enabled: v } : x))} />
              <Button type="button" size="icon" variant="ghost" onClick={() => setPayment(payment.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
        </section>

        {/* PayPal */}
        <section className="border rounded-lg p-6 bg-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">PayPal (כרטיס אשראי + PayPal)</h3>
            <label className="flex items-center gap-2 text-sm">
              פעיל <Switch checked={paypal.enabled} onCheckedChange={(v) => setPaypal({ ...paypal, enabled: v })} />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            מוסיף אפשרות תשלום "PayPal" בצ'קאאוט עם כפתורי PayPal וכרטיס דביט/אשראי.
            קבל Client ID ב-<a className="underline" href="https://developer.paypal.com/dashboard/applications" target="_blank" rel="noreferrer">developer.paypal.com</a>.
          </p>
          <div className="grid sm:grid-cols-[1fr_180px] gap-3">
            <div className="space-y-2">
              <Label>PayPal Client ID</Label>
              <Input value={paypal.client_id} onChange={(e) => setPaypal({ ...paypal, client_id: e.target.value.trim() })} placeholder="AYSq3RDGsmBLJE-..." autoComplete="off" spellCheck={false} />
            </div>
            <div className="space-y-2">
              <Label>מצב</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={paypal.mode} onChange={(e) => setPaypal({ ...paypal, mode: e.target.value as "sandbox" | "live" })}>
                <option value="sandbox">Sandbox (בדיקה)</option>
                <option value="live">Live (כסף אמיתי)</option>
              </select>
            </div>
          </div>
        </section>

        {/* Square */}
        <section className="border rounded-lg p-6 bg-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Square (כרטיס אשראי / דביט)</h3>
            <label className="flex items-center gap-2 text-sm">
              פעיל <Switch checked={square.enabled} onCheckedChange={(v) => setSquare({ ...square, enabled: v })} />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            מוסיף אפשרות תשלום "Square" בצ'קאאוט באמצעות Square Web Payments SDK.
            קבל Application ID ו-Location ID ב-<a className="underline" href="https://developer.squareup.com/apps" target="_blank" rel="noreferrer">developer.squareup.com</a>.
            ה-Access Token וה-Webhook Signature Key נשמרים כסיקרטים בשרת.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Application ID</Label>
              <Input value={square.application_id} onChange={(e) => setSquare({ ...square, application_id: e.target.value.trim() })} placeholder="sq0idp-..." autoComplete="off" spellCheck={false} />
            </div>
            <div className="space-y-2">
              <Label>Location ID</Label>
              <Input value={square.location_id} onChange={(e) => setSquare({ ...square, location_id: e.target.value.trim() })} placeholder="LBS8C676K329X" autoComplete="off" spellCheck={false} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>מצב</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={square.mode} onChange={(e) => setSquare({ ...square, mode: e.target.value as "sandbox" | "production" })}>
                <option value="sandbox">Sandbox (בדיקה)</option>
                <option value="production">Production (כסף אמיתי)</option>
              </select>
            </div>
          </div>
          <div className="text-xs text-muted-foreground border-t pt-3">
            Webhook URL (הדבק ב-Square Developer Dashboard → Webhooks → Notification URL):
            <code className="block mt-1 p-2 bg-muted rounded break-all">https://auth-gateway-home.lovable.app/api/public/square-webhook</code>
            הירשם לאירועים: <strong>payment.created</strong>, <strong>payment.updated</strong>.
          </div>
        </section>

        <Button type="submit" disabled={busy} className="w-full">{busy ? "שומר..." : "שמור"}</Button>
      </form>
    </div>
  );
}
