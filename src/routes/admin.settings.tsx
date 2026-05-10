import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
});

type ShippingMethod = { name: string; price: number };
type PaymentMethod = { name: string; enabled: boolean };
type Hero = { image: string; title: string; subtitle: string; cta_text: string; cta_link: string };
type PayPal = { enabled: boolean; client_id: string; mode: "sandbox" | "live" };
type Company = { name: string; address: string; email: string; phone: string; tax_id: string; logo: string; invoice_prefix: string };

const DEFAULT_HERO: Hero = {
  image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1600",
  title: "Timeless wardrobe staples.",
  subtitle: "Modern essentials, classic silhouettes — crafted to last.",
  cta_text: "Shop now",
  cta_link: "/shop",
};
const DEFAULT_PAYPAL: PayPal = { enabled: false, client_id: "", mode: "sandbox" };
const DEFAULT_COMPANY: Company = { name: "", address: "", email: "", phone: "", tax_id: "", logo: "", invoice_prefix: "INV" };

function AdminSettings() {
  const { t } = useT();
  const { user } = useAuth();
  const [shipping, setShipping] = useState<ShippingMethod[]>([{ name: "Standard", price: 5.99 }]);
  const [payment, setPayment] = useState<PaymentMethod[]>([{ name: "Cash on Delivery", enabled: true }]);
  const [freeThreshold, setFreeThreshold] = useState<string>("");
  const [hero, setHero] = useState<Hero>(DEFAULT_HERO);
  const [carousel, setCarousel] = useState<string[]>([]);
  const [paypal, setPaypal] = useState<PayPal>(DEFAULT_PAYPAL);
  const [company, setCompany] = useState<Company>(DEFAULT_COMPANY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("store_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => {
      if (!data) return;
      setShipping(data.shipping_methods ?? [{ name: "Standard", price: 5.99 }]);
      setPayment(data.payment_methods ?? [{ name: "Cash on Delivery", enabled: true }]);
      setFreeThreshold(data.free_shipping_threshold?.toString() ?? "");
      if (data.hero) setHero({ ...DEFAULT_HERO, ...(data.hero as Hero) });
      if (Array.isArray(data.carousel_images)) setCarousel(data.carousel_images);
      if (data.paypal) setPaypal({ ...DEFAULT_PAYPAL, ...(data.paypal as PayPal) });
      if (data.company) setCompany({ ...DEFAULT_COMPANY, ...(data.company as Company) });
    });
  }, []);

  const uploadTo = async (file: File, onDone: (url: string) => void) => {
    if (!user) { toast.error("Not signed in"); return; }
    const { validateImageFile } = await import("@/lib/security");
    const v = await validateImageFile(file);
    if (!v.ok) { toast.error(v.error); return; }
    const rand = crypto.randomUUID();
    const path = `site/${user.id}/${Date.now()}-${rand}.${v.ext}`;
    const { error } = await supabase.storage.from("upload").upload(path, file, {
      contentType: file.type, upsert: false, cacheControl: "3600",
    });
    if (error) { toast.error("Upload failed: " + error.message); return; }
    const { data } = supabase.storage.from("upload").getPublicUrl(path);
    onDone(data.publicUrl);
    toast.success("Image uploaded");
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("store_settings").upsert({
      id: 1,
      shipping_methods: shipping,
      payment_methods: payment,
      free_shipping_threshold: freeThreshold === "" ? null : Number(freeThreshold),
      hero,
      carousel_images: carousel,
      paypal,
      company,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Saved");
  };

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-display text-3xl font-semibold">{t("admin.settings")}</h1>
      <form onSubmit={save} className="space-y-6">
        {/* Hero banner */}
        <section className="border rounded-lg p-6 bg-card space-y-4">
          <h3 className="font-semibold">Hero banner (homepage)</h3>
          <div className="space-y-2">
            <Label>Banner image</Label>
            <div className="flex items-start gap-3">
              <div className="w-40 h-24 rounded overflow-hidden bg-muted border flex-shrink-0">
                {hero.image && <img src={hero.image} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 space-y-2">
                <Input value={hero.image} onChange={(e) => setHero({ ...hero, image: e.target.value })} placeholder="Image URL" />
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer text-primary hover:underline">
                  <Upload className="h-4 w-4" /> Upload new image
                  <input type="file" accept="image/png,image/jpeg" hidden
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadTo(f, (u) => setHero({ ...hero, image: u })); e.target.value = ""; }} />
                </label>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={hero.title} onChange={(e) => setHero({ ...hero, title: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Subtitle</Label>
            <Textarea rows={2} value={hero.subtitle} onChange={(e) => setHero({ ...hero, subtitle: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Button text</Label><Input value={hero.cta_text} onChange={(e) => setHero({ ...hero, cta_text: e.target.value })} /></div>
            <div className="space-y-2"><Label>Button link</Label><Input value={hero.cta_link} onChange={(e) => setHero({ ...hero, cta_link: e.target.value })} /></div>
          </div>
        </section>

        {/* Carousel */}
        <section className="border rounded-lg p-6 bg-card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Homepage carousel</h3>
            <span className="text-xs text-muted-foreground">Promo slides shown on the homepage</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {carousel.map((src, i) => (
              <div key={src + i} className="relative w-32 h-20 rounded overflow-hidden border bg-muted group">
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => setCarousel(carousel.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded p-0.5 opacity-0 group-hover:opacity-100">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <label className="w-32 h-20 border-2 border-dashed rounded flex flex-col items-center justify-center cursor-pointer text-xs text-muted-foreground hover:bg-muted/40">
              <Upload className="h-4 w-4 mb-1" /> Upload
              <input type="file" accept="image/png,image/jpeg" hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadTo(f, (u) => setCarousel((c) => [...c, u])); e.target.value = ""; }} />
            </label>
          </div>
          <div className="flex gap-2 pt-2 border-t">
            <Input id="carousel-url" placeholder="Or paste image URL" />
            <Button type="button" variant="outline" onClick={() => {
              const el = document.getElementById("carousel-url") as HTMLInputElement;
              const u = el?.value.trim(); if (u) { setCarousel([...carousel, u]); el.value = ""; }
            }}>Add</Button>
          </div>
        </section>

        {/* Shipping */}
        <section className="border rounded-lg p-6 bg-card space-y-3">
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
        </section>

        {/* Payment */}
        <section className="border rounded-lg p-6 bg-card space-y-3">
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
        </section>

        {/* PayPal */}
        <section className="border rounded-lg p-6 bg-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">PayPal (Credit card + PayPal)</h3>
            <label className="flex items-center gap-2 text-sm">
              Enabled <Switch checked={paypal.enabled} onCheckedChange={(v) => setPaypal({ ...paypal, enabled: v })} />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            Adds a "PayPal" payment option at checkout with both PayPal balance and Debit/Credit Card buttons.
            Get your Client ID at <a className="underline" href="https://developer.paypal.com/dashboard/applications" target="_blank" rel="noreferrer">developer.paypal.com</a>.
          </p>
          <div className="grid sm:grid-cols-[1fr_180px] gap-3">
            <div className="space-y-2">
              <Label>PayPal Client ID</Label>
              <Input
                value={paypal.client_id}
                onChange={(e) => setPaypal({ ...paypal, client_id: e.target.value.trim() })}
                placeholder="AYSq3RDGsmBLJE-otTkBtM-jBRd1TCQwFf9RGfwddNXWz0uFU9ztymylOhRS"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="space-y-2">
              <Label>Mode</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={paypal.mode}
                onChange={(e) => setPaypal({ ...paypal, mode: e.target.value as "sandbox" | "live" })}
              >
                <option value="sandbox">Sandbox (test)</option>
                <option value="live">Live (real money)</option>
              </select>
            </div>
          </div>
        </section>

        {/* Company / Invoice details */}
        <section className="border rounded-lg p-6 bg-card space-y-4">
          <h3 className="font-semibold">Company details (for invoices / receipts)</h3>
          <p className="text-xs text-muted-foreground">These appear on every invoice PDF.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Company name</Label><Input value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Tax ID / VAT number</Label><Input value={company.tax_id} onChange={(e) => setCompany({ ...company, tax_id: e.target.value })} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Address</Label><Input value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={company.email} onChange={(e) => setCompany({ ...company, email: e.target.value })} /></div>
            <div className="space-y-2"><Label>Phone</Label><Input value={company.phone} onChange={(e) => setCompany({ ...company, phone: e.target.value })} /></div>
            <div className="space-y-2"><Label>Invoice number prefix</Label><Input value={company.invoice_prefix} onChange={(e) => setCompany({ ...company, invoice_prefix: e.target.value.toUpperCase() })} placeholder="INV" /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Logo URL (optional)</Label><Input value={company.logo} onChange={(e) => setCompany({ ...company, logo: e.target.value })} /></div>
          </div>
        </section>

        <Button type="submit" disabled={busy} className="w-full">{busy ? "Saving..." : t("common.save")}</Button>
      </form>
    </div>
  );
}
