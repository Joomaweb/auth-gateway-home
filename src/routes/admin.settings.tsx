import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
});

type ShippingMethod = { name: string; price: number };
type PaymentMethod = { name: string; enabled: boolean };

function AdminSettings() {
  const { t } = useT();
  const [shipping, setShipping] = useState<ShippingMethod[]>([]);
  const [payment, setPayment] = useState<PaymentMethod[]>([]);
  const [freeThreshold, setFreeThreshold] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("store_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) {
        setShipping(data.shipping_methods ?? []);
        setPayment(data.payment_methods ?? []);
        setFreeThreshold(data.free_shipping_threshold?.toString() ?? "");
      } else {
        setShipping([{ name: "Standard", price: 5.99 }]);
        setPayment([{ name: "Cash on Delivery", enabled: true }]);
      }
    });
  }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("store_settings").upsert({
      id: 1,
      shipping_methods: shipping,
      payment_methods: payment,
      free_shipping_threshold: freeThreshold === "" ? null : Number(freeThreshold),
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Saved");
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-3xl font-semibold">{t("admin.settings")}</h1>
      <form onSubmit={save} className="space-y-6">
        <div className="border rounded-lg p-6 bg-card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Shipping methods</h3>
            <Button type="button" size="sm" variant="outline" onClick={() => setShipping([...shipping, { name: "", price: 0 }])}>
              <Plus className="h-3 w-3 me-1" /> Add
            </Button>
          </div>
          {shipping.map((s, i) => (
            <div key={i} className="grid grid-cols-[1fr_120px_auto] gap-2">
              <Input placeholder="Name" value={s.name} onChange={(e) => setShipping(shipping.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
              <Input type="number" step="0.01" placeholder="Price" value={s.price} onChange={(e) => setShipping(shipping.map((x, j) => j === i ? { ...x, price: Number(e.target.value) } : x))} />
              <Button type="button" size="icon" variant="ghost" onClick={() => setShipping(shipping.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
          <div className="space-y-2 pt-3 border-t">
            <Label>Free shipping over (leave empty to disable)</Label>
            <Input type="number" step="0.01" value={freeThreshold} onChange={(e) => setFreeThreshold(e.target.value)} />
          </div>
        </div>

        <div className="border rounded-lg p-6 bg-card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Payment methods</h3>
            <Button type="button" size="sm" variant="outline" onClick={() => setPayment([...payment, { name: "", enabled: true }])}>
              <Plus className="h-3 w-3 me-1" /> Add
            </Button>
          </div>
          {payment.map((p, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
              <Input placeholder="Name" value={p.name} onChange={(e) => setPayment(payment.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
              <Switch checked={p.enabled} onCheckedChange={(v) => setPayment(payment.map((x, j) => j === i ? { ...x, enabled: v } : x))} />
              <Button type="button" size="icon" variant="ghost" onClick={() => setPayment(payment.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
        </div>

        <Button type="submit" disabled={busy} className="w-full">{busy ? "Saving..." : t("common.save")}</Button>
      </form>
    </div>
  );
}
