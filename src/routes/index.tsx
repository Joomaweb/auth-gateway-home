import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { ProductCard, type ProductCardData } from "@/components/product/ProductCard";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { useRealtime } from "@/hooks/use-realtime";
import { optimizeImg, srcSet } from "@/lib/img";
import { run } from "@/lib/api";
import { getPublicStoreSettings } from "@/lib/store-settings";
import { clearAppDataCaches, subscribeAppDataChanges } from "@/lib/realtime-sync";

export const Route = createFileRoute("/")({
  component: HomePage,
});

type Category = { id: string; name: string; slug: string; image_url: string | null };
type Hero = {
  image: string;
  title: string;
  subtitle: string;
  cta_text: string;
  cta_link: string;
  badge: string;
  pos_x?: number;
  pos_y?: number;
  show_overlay?: boolean;
};

type HomeData = {
  featured: ProductCardData[];
  sale: ProductCardData[];
  newest: ProductCardData[];
  cats: Category[];
  hero: Hero;
  heroVideo: string;
  slides: string[];
  showFeatured: boolean;
  showSale: boolean;
};

const CACHE_KEY = "home:v3";

function toEmbedUrl(url: string): string {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]+)/i);
  if (yt) {
    return `https://www.youtube.com/embed/${yt[1]}?autoplay=1&mute=1&loop=1&playlist=${yt[1]}&controls=0&modestbranding=1&playsinline=1&rel=0`;
  }
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?autoplay=1&muted=1&loop=1&background=1`;
  return url;
}
const CACHE_TTL = 10 * 60_000; // 10 min

async function fetchHome(): Promise<HomeData> {
  const [n, c, ss] = await Promise.all([
    run({ key: "home:newest", timeoutMs: 5000, attempts: 2, cacheMs: 60_000 }, () =>
      supabase
        .from("products")
        .select("id,name,price,sale_price,images,created_at")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(6),
    ),
    run({ key: "home:cats", timeoutMs: 5000, attempts: 2, cacheMs: 60_000 }, () =>
      supabase.from("categories").select("id,name,slug,image_url"),
    ),
    getPublicStoreSettings(),
  ]);
  const d = ss as {
    hero?: Hero;
    hero_video?: string;
    carousel_images?: string[];
    show_featured?: boolean;
    show_sale?: boolean;
  } | null;
  const [f, s] = await Promise.all([
    d?.show_featured === false
      ? Promise.resolve({ data: [] })
      : run({ key: "home:featured", timeoutMs: 5000, attempts: 2, cacheMs: 60_000 }, () =>
          supabase
            .from("products")
            .select("id,name,price,sale_price,images,featured")
            .eq("active", true)
            .eq("featured", true)
            .limit(12),
        ),
    d?.show_sale === false
      ? Promise.resolve({ data: [] })
      : run({ key: "home:sale", timeoutMs: 5000, attempts: 2, cacheMs: 60_000 }, () =>
          supabase
            .from("products")
            .select("id,name,price,sale_price,images")
            .eq("active", true)
            .not("sale_price", "is", null)
            .limit(8),
        ),
  ]);
  const data: HomeData = {
    featured: (f.data ?? []) as ProductCardData[],
    sale: (s.data ?? []) as ProductCardData[],
    newest: (n.data ?? []) as ProductCardData[],
    cats: (c.data ?? []) as Category[],
    hero: (d?.hero as Hero) ?? {
      image: "",
      title: "",
      subtitle: "",
      cta_text: "",
      cta_link: "",
      badge: "",
      show_overlay: false,
    },
    heroVideo: d?.hero_video ?? "",
    slides: Array.isArray(d?.carousel_images) ? (d!.carousel_images as string[]) : [],
    showFeatured: d?.show_featured ?? true,
    showSale: d?.show_sale ?? true,
  };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), d: data }));
  } catch {
    /* ignore quota */
  }
  return data;
}

function HomePage() {
  const { t } = useT();
  const [showDeferredMedia, setShowDeferredMedia] = useState(false);
  const { data, refetch } = useQuery({
    queryKey: ["home"],
    queryFn: fetchHome,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: true,
  });
  const featured = data?.featured ?? [];
  const sale = data?.sale ?? [];
  const newest = data?.newest ?? [];
  const cats = data?.cats ?? [];
  const hero = data?.hero ?? null;
  const heroVideo = data?.heroVideo ?? "";
  const slides = data?.slides ?? [];
  const showFeatured = data?.showFeatured ?? true;
  const showSale = data?.showSale ?? true;
  const isDirectHeroVideo = !!heroVideo && !/youtube\.com|youtu\.be|vimeo\.com/i.test(heroVideo);

  // Defer realtime subscriptions until after first paint so they don't slow TTI.
  const [rtReady, setRtReady] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setRtReady(true), 1500);
    return () => clearTimeout(id);
  }, []);
  useEffect(
    () =>
      subscribeAppDataChanges(() => {
        clearAppDataCaches();
        refetch();
      }),
    [refetch],
  );
  useEffect(() => {
    const start = () => setShowDeferredMedia(true);
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const id = window.requestIdleCallback(start, { timeout: 250 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(start, 120);
    return () => clearTimeout(id);
  }, []);
  useRealtime(rtReady ? "products" : "", () => {
    clearAppDataCaches();
    refetch();
  });
  useRealtime(rtReady ? "categories" : "", () => {
    clearAppDataCaches();
    refetch();
  });
  useRealtime(rtReady ? "store_settings" : "", () => {
    clearAppDataCaches();
    refetch();
  });

  return (
    <PublicLayout>
      {/* Hero */}
      {!hero ? (
        <section className="relative h-[78vh] min-h-[560px] bg-muted animate-pulse" />
      ) : (
        <section
          className={`relative h-[78vh] min-h-[560px] flex items-center justify-center overflow-hidden ${heroVideo ? "bg-black" : "bg-muted"}`}
        >
          {isDirectHeroVideo ? (
            <video
              src={heroVideo}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              className="absolute inset-0 w-full h-full object-cover scale-105"
              style={{ objectPosition: `${hero.pos_x ?? 50}% ${hero.pos_y ?? 50}%` }}
            />
          ) : heroVideo ? (
            <iframe
              src={toEmbedUrl(heroVideo)}
              title="Hero video"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-[177.78vh] min-w-full h-[56.25vw] min-h-full -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2 pointer-events-none"
            />
          ) : (
            <img
              src={optimizeImg(hero.image, { w: 1920, q: 75 })}
              srcSet={srcSet(hero.image, 1280, 75)}
              sizes="100vw"
              alt="Hero"
              fetchPriority="high"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover scale-105"
              style={{ objectPosition: `${hero.pos_x ?? 50}% ${hero.pos_y ?? 50}%` }}
            />
          )}

          {hero.show_overlay !== false && (
            <>
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-background/10" />
              <div
                className="absolute inset-0 opacity-[0.07] mix-blend-overlay"
                style={{
                  backgroundImage:
                    "linear-gradient(oklch(0.18 0.005 60) 1px, transparent 1px), linear-gradient(90deg, oklch(0.18 0.005 60) 1px, transparent 1px)",
                  backgroundSize: "32px 32px",
                }}
              />
              <div className="absolute -top-32 -right-24 w-[420px] h-[420px] rounded-full bg-gradient-gold opacity-30 blur-3xl animate-float-slow" />
              <div className="relative z-10 text-center px-4 max-w-3xl animate-fade-up">
                {hero.badge?.trim() && (
                  <span className="inline-flex items-center gap-2 text-[10px] tracking-[0.4em] uppercase text-gold font-semibold mb-5 px-3 py-1 rounded-full glass-panel">
                    <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse" /> {hero.badge}
                  </span>
                )}
                {hero.title?.trim() && (
                  <h1 className="font-display text-5xl md:text-7xl font-semibold tracking-tight text-gradient-gold">
                    {hero.title}
                  </h1>
                )}
                {(hero.title?.trim() || hero.subtitle?.trim()) && (
                  <div className="hairline-gold w-40 mx-auto my-5" />
                )}
                {hero.subtitle?.trim() && (
                  <p className="text-lg text-foreground/75 max-w-xl mx-auto">{hero.subtitle}</p>
                )}
                {hero.cta_text?.trim() && (
                  <Button
                    asChild
                    size="lg"
                    className="mt-8 ring-gold-soft bg-gradient-gold text-gold-foreground hover:opacity-90"
                  >
                    <a href={hero.cta_link}>{hero.cta_text}</a>
                  </Button>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {/* Promo carousel */}
      {showDeferredMedia && slides.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-10">
          <Carousel opts={{ loop: true }}>
            <CarouselContent>
              {slides.map((src, i) => (
                <CarouselItem key={i}>
                  <div className="aspect-[16/6] rounded-lg overflow-hidden bg-muted">
                    <img
                      src={optimizeImg(src, { w: 1600, q: 70 })}
                      srcSet={srcSet(src, 1280, 70)}
                      sizes="100vw"
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        </section>
      )}

      {/* Categories */}
      {cats.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-12 md:py-16">
          <h2 className="font-display text-2xl md:text-3xl font-semibold mb-6 md:mb-8">
            {t("home.categories")}
          </h2>
          {/* Mobile carousel */}
          <div className="md:hidden">
            <Carousel opts={{ align: "start" }}>
              <CarouselContent className="-ms-3">
                {cats.map((c) => (
                  <CarouselItem key={c.id} className="ps-3 basis-3/4 sm:basis-1/2">
                    <Link
                      to="/shop"
                      search={{ category: c.slug }}
                      className="group relative block aspect-[4/3] overflow-hidden rounded-xl bg-muted shadow-soft"
                    >
                      <img
                        src={optimizeImg(
                          c.image_url ??
                            "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800",
                          { w: 600 },
                        )}
                        srcSet={srcSet(
                          c.image_url ??
                            "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800",
                          600,
                        )}
                        sizes="(max-width: 768px) 75vw, 33vw"
                        alt={c.name}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent flex items-end p-4">
                        <h3 className="text-white font-display text-xl font-semibold drop-shadow">
                          {c.name}
                        </h3>
                      </div>
                    </Link>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          </div>
          {/* Desktop grid */}
          <div className="hidden md:grid gap-4 grid-cols-3">
            {cats.map((c) => (
              <Link
                key={c.id}
                to="/shop"
                search={{ category: c.slug }}
                className="group relative aspect-[4/3] overflow-hidden rounded-lg bg-muted"
              >
                <img
                  src={optimizeImg(
                    c.image_url ??
                      "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800",
                    { w: 600 },
                  )}
                  srcSet={srcSet(
                    c.image_url ??
                      "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800",
                    600,
                  )}
                  sizes="33vw"
                  alt={c.name}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />

                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <h3 className="text-white font-display text-2xl font-semibold">{c.name}</h3>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Newest arrivals */}
      {newest.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-12 md:py-16">
          <h2 className="font-display text-2xl md:text-3xl font-semibold mb-6 md:mb-8">
            {t("home.newArrivals")}
          </h2>
          <Carousel opts={{ align: "start" }}>
            <CarouselContent className="-ms-3 md:-ms-4">
              {newest.map((p) => (
                <CarouselItem
                  key={p.id}
                  className="ps-3 md:ps-4 basis-1/2 sm:basis-1/3 md:basis-1/4 lg:basis-1/5"
                >
                  <ProductCard p={p} />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden md:flex" />
            <CarouselNext className="hidden md:flex" />
          </Carousel>
        </section>
      )}

      {/* Featured carousel */}
      {showFeatured && featured.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-16">
          <h2 className="font-display text-3xl font-semibold mb-8">{t("home.featured")}</h2>
          <Carousel opts={{ align: "start" }}>
            <CarouselContent className="-ms-4">
              {featured.map((p) => (
                <CarouselItem key={p.id} className="ps-4 basis-1/2 md:basis-1/3 lg:basis-1/4">
                  <ProductCard p={p} />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        </section>
      )}

      {/* Sale */}
      {showSale && sale.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-16 border-t">
          <h2 className="font-display text-3xl font-semibold mb-8">{t("home.sale")}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
            {sale.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        </section>
      )}
    </PublicLayout>
  );
}
