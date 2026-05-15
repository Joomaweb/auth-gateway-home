import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
});

type ShippingMethod = { name: string; price: number };
type ShippingZone = { name: string; price: number; eta: string };
type Hero = { image: string; title: string; subtitle: string; cta_text: string; cta_link: string; badge: string; pos_x?: number; pos_y?: number; show_overlay?: boolean };
type Branding = { logo_url: string; favicon_url: string; site_name: string };
type Company = { name: string; address: string; email: string; phone: string; tax_id: string; logo: string; invoice_prefix: string };

const DEFAULT_HERO: Hero = {
  image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1600",
  title: "Timeless wardrobe staples.",
  subtitle: "Modern essentials, classic silhouettes — crafted to last.",
  cta_text: "Shop now",
  cta_link: "/shop",
  badge: "Atelier · 2026",
  pos_x: 50,
  pos_y: 50,
  show_overlay: true,
};
const DEFAULT_BRANDING: Branding = { logo_url: "", favicon_url: "", site_name: "ATELIER" };
const DEFAULT_COMPANY: Company = { name: "", address: "", email: "", phone: "", tax_id: "", logo: "", invoice_prefix: "INV" };

function AdminSettings() {
  const { t } = useT();
  const { user } = useAuth();
  const [shipping, setShipping] = useState<ShippingMethod[]>([{ name: "Standard", price: 5.99 }]);
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [freeThreshold, setFreeThreshold] = useState<string>("");
  const [hero, setHero] = useState<Hero>(DEFAULT_HERO);
  const [heroVideo, setHeroVideo] = useState<string>("");
  const [carousel, setCarousel] = useState<string[]>([]);
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);
  const [company, setCompany] = useState<Company>(DEFAULT_COMPANY);
  const [showFeatured, setShowFeatured] = useState(true);
  const [showSale, setShowSale] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploadingVid, setUploadingVid] = useState(false);

  useEffect(() => {
    supabase.from("store_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => {
      if (!data) return;
      setShipping(data.shipping_methods ?? [{ name: "Standard", price: 5.99 }]);
      setZones(Array.isArray(data.shipping_zones) ? data.shipping_zones : []);
      setFreeThreshold(data.free_shipping_threshold?.toString() ?? "");
      if (data.hero) setHero({ ...DEFAULT_HERO, ...(data.hero as Hero) });
      setHeroVideo(data.hero_video ?? "");
      if (Array.isArray(data.carousel_images)) setCarousel(data.carousel_images);
      if (data.branding) setBranding({ ...DEFAULT_BRANDING, ...(data.branding as Branding) });
      if (data.company) setCompany({ ...DEFAULT_COMPANY, ...(data.company as Company) });
      setShowFeatured(data.show_featured ?? true);
      setShowSale(data.show_sale ?? true);
    });
  }, []);

  const uploadTo = async (file: File, onDone: (url: string) => void) => {
    if (!user) { toast.error("Not signed in"); return; }
    const { validateImageFile, downscaleImage } = await import("@/lib/security");
    const v = await validateImageFile(file);
    if (!v.ok) { toast.error(v.error); return; }
    const small = await downscaleImage(file);
    const ext = small.type === "image/png" ? "png" : small.type === "image/webp" ? "webp" : "jpg";
    const rand = crypto.randomUUID();
    const path = `site/${user.id}/${Date.now()}-${rand}.${ext}`;
    const { error } = await supabase.storage.from("upload").upload(path, small, {
      contentType: small.type, upsert: false, cacheControl: "3600",
    });
    if (error) { toast.error("Upload failed: " + error.message); return; }
    const { data } = supabase.storage.from("upload").getPublicUrl(path);
    onDone(data.publicUrl);
    toast.success("Image uploaded");
  };

  const uploadVideoTo = async (file: File, onDone: (url: string) => void) => {
    if (!user) { toast.error("Not signed in"); return; }
    const { validateVideoFile } = await import("@/lib/security");
    const v = await validateVideoFile(file);
    if (!v.ok) { toast.error(v.error); return; }
    setUploadingVid(true);
    try {
      const path = `site/${user.id}/video-${Date.now()}-${crypto.randomUUID()}.${v.ext}`;
      const { error } = await supabase.storage.from("upload").upload(path, file, {
        contentType: file.type, upsert: false, cacheControl: "31536000",
      });
      if (error) { toast.error("Video upload failed: " + error.message); return; }
      const { data } = supabase.storage.from("upload").getPublicUrl(path);
      onDone(data.publicUrl);
      toast.success("הסרטון הועלה");
    } finally {
      setUploadingVid(false);
    }
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("store_settings").upsert({
      id: 1,
      shipping_methods: shipping,
      shipping_zones: zones,
      free_shipping_threshold: freeThreshold === "" ? null : Number(freeThreshold),
      hero,
      hero_video: heroVideo || null,
      carousel_images: carousel,
      branding,
      company,
      show_featured: showFeatured,
      show_sale: showSale,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Saved");
  };

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-display text-3xl font-semibold">{t("admin.settings")}</h1>
      <form onSubmit={save} className="space-y-6">
        {/* Branding: logo + favicon + site name */}
        <section className="border rounded-lg p-6 bg-card space-y-4">
          <h3 className="font-semibold">מיתוג / Branding</h3>
          <p className="text-xs text-muted-foreground">לוגו ואייקון האתר מתעדכנים בזמן אמת בכל הדפים.</p>

          <div className="space-y-2">
            <Label>שם האתר (Site name)</Label>
            <Input value={branding.site_name} onChange={(e) => setBranding({ ...branding, site_name: e.target.value })} placeholder="ATELIER" />
          </div>

          <div className="space-y-2">
            <Label>לוגו (Logo)</Label>
            <div className="flex items-start gap-3">
              <div className="w-40 h-16 rounded overflow-hidden bg-muted border flex-shrink-0 flex items-center justify-center">
                {branding.logo_url ? <img src={branding.logo_url} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">ללא לוגו</span>}
              </div>
              <div className="flex-1 space-y-2">
                <Input value={branding.logo_url} onChange={(e) => setBranding({ ...branding, logo_url: e.target.value })} placeholder="https://..." />
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer text-primary hover:underline">
                  <Upload className="h-4 w-4" /> העלה לוגו
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadTo(f, (u) => setBranding({ ...branding, logo_url: u })); e.target.value = ""; }} />
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>אייקון האתר (Favicon)</Label>
            <div className="flex items-start gap-3">
              <div className="w-16 h-16 rounded overflow-hidden bg-muted border flex-shrink-0 flex items-center justify-center">
                {branding.favicon_url ? <img src={branding.favicon_url} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">—</span>}
              </div>
              <div className="flex-1 space-y-2">
                <Input value={branding.favicon_url} onChange={(e) => setBranding({ ...branding, favicon_url: e.target.value })} placeholder="https://..." />
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer text-primary hover:underline">
                  <Upload className="h-4 w-4" /> העלה אייקון
                  <input type="file" accept="image/png,image/x-icon,image/svg+xml" hidden
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadTo(f, (u) => setBranding({ ...branding, favicon_url: u })); e.target.value = ""; }} />
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* Hero banner */}
        <section className="border rounded-lg p-6 bg-card space-y-4">
          <h3 className="font-semibold">Hero banner (homepage)</h3>
          <div className="space-y-2">
            <Label>Banner image</Label>
            <div className="flex items-start gap-3">
              <div className="w-40 h-24 rounded overflow-hidden bg-muted border flex-shrink-0">
                {heroVideo && !/youtube\.com|youtu\.be|vimeo\.com/i.test(heroVideo) ? (
                  <video src={heroVideo} muted playsInline autoPlay loop className="w-full h-full object-cover"
                    style={{ objectPosition: `${hero.pos_x ?? 50}% ${hero.pos_y ?? 50}%` }} />
                ) : hero.image ? (
                  <img src={hero.image} alt="" className="w-full h-full object-cover"
                    style={{ objectPosition: `${hero.pos_x ?? 50}% ${hero.pos_y ?? 50}%` }} />
                ) : null}
              </div>
              <div className="flex-1 space-y-2">
                <Input value={hero.image} onChange={(e) => setHero({ ...hero, image: e.target.value })} placeholder="Image URL" />
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer text-primary hover:underline">
                  <Upload className="h-4 w-4" /> Upload new image
                  <input type="file" accept="image/png,image/jpeg,image/webp" hidden
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadTo(f, (u) => setHero({ ...hero, image: u })); e.target.value = ""; }} />
                </label>
              </div>
            </div>
          </div>

          {/* Position controls (apply to image OR video) */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="space-y-1">
              <Label className="flex justify-between text-xs">
                <span>מיקום אופקי (X)</span>
                <span className="text-muted-foreground">{hero.pos_x ?? 50}%</span>
              </Label>
              <input type="range" min={0} max={100} value={hero.pos_x ?? 50}
                onChange={(e) => setHero({ ...hero, pos_x: Number(e.target.value) })}
                className="w-full accent-primary" />
            </div>
            <div className="space-y-1">
              <Label className="flex justify-between text-xs">
                <span>מיקום אנכי (Y)</span>
                <span className="text-muted-foreground">{hero.pos_y ?? 50}%</span>
              </Label>
              <input type="range" min={0} max={100} value={hero.pos_y ?? 50}
                onChange={(e) => setHero({ ...hero, pos_y: Number(e.target.value) })}
                className="w-full accent-primary" />
            </div>
            <button type="button" onClick={() => setHero({ ...hero, pos_x: 50, pos_y: 50 })}
              className="col-span-2 text-xs text-muted-foreground hover:text-foreground underline justify-self-start">
              איפוס למרכז
            </button>
          </div>

          <label className="flex items-center justify-between gap-3 p-3 rounded border bg-muted/30">
            <div>
              <div className="text-sm font-medium">הצג כיתובים וכפתור על ה-Hero</div>
              <p className="text-xs text-muted-foreground">כבה כדי להציג את הסרטון/תמונה בלבד, ללא טקסטים וכפתור.</p>
            </div>
            <input type="checkbox" className="h-5 w-5" checked={hero.show_overlay !== false}
              onChange={(e) => setHero({ ...hero, show_overlay: e.target.checked })} />
          </label>

          <div className="space-y-2">
            <Label>תגית עליונה (Badge) — מעל הכותרת</Label>
            <Input value={hero.badge} onChange={(e) => setHero({ ...hero, badge: e.target.value })} placeholder="Atelier · 2026" />
            <p className="text-xs text-muted-foreground">השאר ריק כדי להסתיר. השינוי בזמן אמת.</p>
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

          {/* Hero video (overlays the image when set) */}
          <div className="space-y-2 pt-3 border-t">
            <Label>סרטון רקע (אופציונלי) — מוצג מעל תמונת ה-Hero</Label>
            {heroVideo && (
              <div className="relative max-w-md rounded overflow-hidden bg-black">
                <video src={heroVideo} controls className="w-full aspect-video" />
                <button type="button" onClick={() => setHeroVideo("")} className="absolute top-2 end-2 bg-destructive text-destructive-foreground rounded p-1">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <Input value={heroVideo} onChange={(e) => setHeroVideo(e.target.value)} placeholder="https://... (קובץ MP4 או YouTube/Vimeo)" />
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm cursor-pointer hover:bg-muted whitespace-nowrap">
                <Upload className="h-4 w-4" /> {uploadingVid ? "מעלה…" : "העלה"}
                <input type="file" accept="video/mp4,video/webm,video/quicktime" hidden disabled={uploadingVid}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadVideoTo(f, setHeroVideo); e.target.value = ""; }} />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">MP4 / WEBM / MOV עד 200MB. אם יוזן קישור YouTube/Vimeo — יוצג כקישור (במקום הסרטון).</p>
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
              <input type="file" accept="image/png,image/jpeg,image/webp" hidden
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

        {/* Homepage sections visibility */}
        <section className="border rounded-lg p-6 bg-card space-y-3">
          <h3 className="font-semibold">סקשנים בדף הבית</h3>
          <p className="text-xs text-muted-foreground">הדלק/כבה סקשנים בדף הבית בזמן אמת.</p>
          <label className="flex items-center justify-between gap-3 p-3 rounded border bg-background cursor-pointer">
            <div>
              <div className="font-medium">Featured</div>
              <div className="text-xs text-muted-foreground">קרוסלת מוצרים מומלצים</div>
            </div>
            <input type="checkbox" className="h-5 w-5 accent-primary" checked={showFeatured} onChange={(e) => setShowFeatured(e.target.checked)} />
          </label>
          <label className="flex items-center justify-between gap-3 p-3 rounded border bg-background cursor-pointer">
            <div>
              <div className="font-medium">On Sale</div>
              <div className="text-xs text-muted-foreground">סקשן מוצרי מבצע</div>
            </div>
            <input type="checkbox" className="h-5 w-5 accent-primary" checked={showSale} onChange={(e) => setShowSale(e.target.checked)} />
          </label>
        </section>

        {/* Shipping zones */}
        <section className="border rounded-lg p-6 bg-card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">אזורי משלוח</h3>
            <Button type="button" size="sm" variant="outline" onClick={() => setZones([...zones, { name: "", price: 0, eta: "" }])}>
              <Plus className="h-3 w-3 me-1" /> הוסף אזור
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">הלקוח יבחר אזור בצ׳קאאוט ויראה את המחיר וזמן האספקה.</p>
          {zones.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded">
              אין אזורים. לחץ "הוסף אזור" כדי להגדיר אזור משלוח.
            </p>
          )}
          {zones.map((z, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-[1.2fr_120px_1.4fr_auto] gap-2 items-start">
              <Input placeholder="שם אזור (לדוגמה: מרכז)" value={z.name} onChange={(e) => setZones(zones.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
              <Input type="number" step="0.01" min="0" placeholder="מחיר ₪" value={z.price} onChange={(e) => setZones(zones.map((x, j) => j === i ? { ...x, price: Number(e.target.value) } : x))} />
              <Input placeholder="זמן אספקה (לדוגמה: 1-3 ימי עסקים)" value={z.eta} onChange={(e) => setZones(zones.map((x, j) => j === i ? { ...x, eta: e.target.value } : x))} />
              <Button type="button" size="icon" variant="ghost" onClick={() => setZones(zones.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <div className="space-y-2 pt-3 border-t">
            <Label>משלוח חינם מעל סכום (השאר ריק לביטול)</Label>
            <Input type="number" step="0.01" value={freeThreshold} onChange={(e) => setFreeThreshold(e.target.value)} />
          </div>

          <details className="pt-3 border-t">
            <summary className="text-xs text-muted-foreground cursor-pointer">שיטות משלוח ישנות (לתאימות לאחור)</summary>
            <div className="space-y-2 pt-2">
              {shipping.map((s, i) => (
                <div key={i} className="grid grid-cols-[1fr_120px_auto] gap-2">
                  <Input placeholder="Name" value={s.name} onChange={(e) => setShipping(shipping.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                  <Input type="number" step="0.01" placeholder="Price" value={s.price} onChange={(e) => setShipping(shipping.map((x, j) => j === i ? { ...x, price: Number(e.target.value) } : x))} />
                  <Button type="button" size="icon" variant="ghost" onClick={() => setShipping(shipping.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={() => setShipping([...shipping, { name: "", price: 0 }])}>
                <Plus className="h-3 w-3 me-1" /> Add
              </Button>
            </div>
          </details>
        </section>

        <div className="border-l-4 border-primary bg-primary/5 p-4 rounded text-sm">
          הגדרות תשלום (PayPal, Square, אמצעי תשלום ידניים) עברו לעמוד נפרד —
          <a href="/admin/payments" className="underline font-medium me-1">תשלומים</a>.
        </div>

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
