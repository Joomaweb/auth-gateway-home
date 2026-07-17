import { useEffect, useState, type FormEvent } from "react";
import { X, Mail, Sparkles, Copy, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { subscribePublicStoreSettings, getPublicStoreSettings } from "@/lib/store-settings";
import { toast } from "sonner";

type BannerConfig = {
  enabled: boolean;
  title: string;
  description: string;
  coupon_code: string;
  button_text: string;
  image_url: string;
};

const DEFAULT: BannerConfig = {
  enabled: false,
  title: "",
  description: "",
  coupon_code: "",
  button_text: "Get Discount",
  image_url: "",
};

function parseBanner(value: unknown): BannerConfig {
  if (!value || typeof value !== "object") return DEFAULT;
  const v = value as Record<string, unknown>;
  return {
    enabled: Boolean(v.enabled),
    title: String(v.title ?? ""),
    description: String(v.description ?? ""),
    coupon_code: String(v.coupon_code ?? ""),
    button_text: String(v.button_text ?? "Get Discount"),
    image_url: String(v.image_url ?? ""),
  };
}

export function PromoBanner() {
  const [cfg, setCfg] = useState<BannerConfig>(DEFAULT);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load settings once + subscribe to real-time changes
  useEffect(() => {
    let mounted = true;
    getPublicStoreSettings()
      .then((s) => {
        if (!mounted) return;
        const b = parseBanner((s as { promo_banner?: unknown }).promo_banner);
        setCfg(b);
        if (b.enabled && (b.title || b.description)) {
          // Small delay so it doesn't clash with initial hero animation
          setTimeout(() => mounted && setOpen(true), 900);
        }
      })
      .catch(() => {});
    const unsub = subscribePublicStoreSettings((s) => {
      const b = parseBanner((s as { promo_banner?: unknown }).promo_banner);
      setCfg(b);
      if (!b.enabled) setOpen(false);
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      toast.error("Please enter a valid email");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("banner_subscribers").insert({
      email: clean,
      coupon_code: cfg.coupon_code || null,
      source: "popup",
    });
    setBusy(false);
    if (error && !/duplicate|unique/i.test(error.message)) {
      toast.error("Something went wrong. Please try again.");
      return;
    }
    setDone(true);
  };

  const copyCode = async () => {
    if (!cfg.coupon_code) return;
    try {
      await navigator.clipboard.writeText(cfg.coupon_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label={cfg.title || "Promotion"}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-2xl border animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
      >
        <button
          onClick={() => setOpen(false)}
          className="absolute top-3 end-3 z-10 rounded-full bg-background/80 backdrop-blur p-1.5 hover:bg-background transition"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {cfg.image_url ? (
          <div className="relative h-40 w-full overflow-hidden bg-muted">
            <img src={cfg.image_url} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
          </div>
        ) : (
          <div className="relative h-24 w-full bg-gradient-to-br from-primary/20 via-primary/10 to-transparent flex items-center justify-center">
            <Sparkles className="h-10 w-10 text-primary/70" />
          </div>
        )}

        <div className="p-6 pt-4 space-y-4">
          {!done ? (
            <>
              <div className="space-y-1.5 text-center">
                <h2 className="font-display text-2xl font-semibold leading-tight">
                  {cfg.title || "Get an exclusive offer"}
                </h2>
                {cfg.description && (
                  <p className="text-sm text-muted-foreground">{cfg.description}</p>
                )}
              </div>

              <form onSubmit={submit} className="space-y-2.5">
                <div className="relative">
                  <Mail className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    className="w-full ps-9 pe-3 py-3 rounded-md border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-md bg-primary text-primary-foreground font-medium py-3 text-sm hover:bg-primary/90 transition disabled:opacity-60"
                >
                  {busy ? "Sending..." : cfg.button_text || "Get Discount"}
                </button>
              </form>

              <p className="text-[10px] text-center text-muted-foreground">
                No spam. Unsubscribe anytime.
              </p>
            </>
          ) : (
            <div className="text-center space-y-4 py-2">
              <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Check className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-1">
                <h2 className="font-display text-2xl font-semibold">You're in! 🎉</h2>
                <p className="text-sm text-muted-foreground">
                  {cfg.coupon_code ? "Use this code at checkout:" : "Thanks for subscribing."}
                </p>
              </div>
              {cfg.coupon_code && (
                <button
                  onClick={copyCode}
                  className="w-full flex items-center justify-between gap-2 px-4 py-3 border-2 border-dashed border-primary/50 rounded-lg bg-primary/5 hover:bg-primary/10 transition group"
                >
                  <span className="font-mono font-bold text-lg tracking-widest text-primary">
                    {cfg.coupon_code}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied" : "Copy"}
                  </span>
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="w-full rounded-md bg-primary text-primary-foreground font-medium py-2.5 text-sm hover:bg-primary/90 transition"
              >
                Continue shopping
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
