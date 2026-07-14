import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
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
import { getVideoMimeType, isDirectVideoUrl, toEmbedUrl } from "@/lib/media";
import { useMediaPreload } from "@/hooks/use-media-preload";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCachedMedia } from "@/hooks/use-cached-media";
import { warmMediaCache, pruneMediaCache } from "@/lib/media-cache";

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(homeSettingsQueryOptions()),
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
  pos_x_mobile?: number;
  pos_y_mobile?: number;
  fit?: "cover" | "contain";
  fit_mobile?: "cover" | "contain";
  height_desktop?: number; // vh
  height_mobile?: number; // vh
  scale?: number; // 1 - 2
  scale_mobile?: number;
  show_overlay?: boolean;
};

type HomeCollectionsData = {
  featured: ProductCardData[];
  sale: ProductCardData[];
  newest: ProductCardData[];
  cats: Category[];
};

type HomeSettingsData = {
  hero: Hero;
  heroVideo: string;
  slides: string[];
  showFeatured: boolean;
  showSale: boolean;
};

async function fetchHomeCollections(
  showFeatured: boolean,
  showSale: boolean,
): Promise<HomeCollectionsData> {
  const [n, c] = await Promise.all([
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
  ]);

  const [f, s] = await Promise.all([
    !showFeatured
      ? Promise.resolve({ data: [] })
      : run({ key: "home:featured", timeoutMs: 5000, attempts: 2, cacheMs: 60_000 }, () =>
          supabase
            .from("products")
            .select("id,name,price,sale_price,images,featured")
            .eq("active", true)
            .eq("featured", true)
            .limit(12),
        ),
    !showSale
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

  return {
    featured: (f.data ?? []) as ProductCardData[],
    sale: (s.data ?? []) as ProductCardData[],
    newest: (n.data ?? []) as ProductCardData[],
    cats: (c.data ?? []) as Category[],
  };
}

function homeSettingsQueryOptions() {
  return queryOptions({
    queryKey: ["home", "settings"],
    queryFn: fetchHomeSettings,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: true,
  });
}

function homeCollectionsQueryOptions(showFeatured: boolean, showSale: boolean) {
  return queryOptions({
    queryKey: ["home", "collections", showFeatured, showSale],
    queryFn: () => fetchHomeCollections(showFeatured, showSale),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: true,
  });
}

async function fetchHomeSettings(): Promise<HomeSettingsData> {
  const d = (await getPublicStoreSettings()) as {
    hero?: Hero;
    hero_video?: string;
    carousel_images?: string[];
    show_featured?: boolean;
    show_sale?: boolean;
  } | null;
  return {
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
}

function HomePage() {
  const { t } = useT();
  const [showDeferredMedia, setShowDeferredMedia] = useState(false);
  const [heroVideoReady, setHeroVideoReady] = useState(false);
  const [heroVideoFailed, setHeroVideoFailed] = useState(false);
  const [heroVideoRetry, setHeroVideoRetry] = useState(0);
  const heroVideoRef = useRef<HTMLVideoElement | null>(null);
  const settingsQ = useQuery(homeSettingsQueryOptions());
  const showFeatured = settingsQ.data?.showFeatured ?? true;
  const showSale = settingsQ.data?.showSale ?? true;
  const collectionsQ = useQuery(homeCollectionsQueryOptions(showFeatured, showSale));
  const featured = collectionsQ.data?.featured ?? [];
  const sale = collectionsQ.data?.sale ?? [];
  const newest = collectionsQ.data?.newest ?? [];
  const cats = collectionsQ.data?.cats ?? [];
  const hero = settingsQ.data?.hero ?? null;
  const heroVideo = settingsQ.data?.heroVideo?.trim() ?? "";
  const slides = settingsQ.data?.slides ?? [];
  const isMobile = useIsMobile();
  const isDirectHeroVideo = isDirectVideoUrl(heroVideo);
  const heroPoster = hero?.image ? optimizeImg(hero.image, { w: 1920, q: 65 }) : "";
  const heroPosX = isMobile ? (hero?.pos_x_mobile ?? hero?.pos_x ?? 50) : (hero?.pos_x ?? 50);
  const heroPosY = isMobile ? (hero?.pos_y_mobile ?? hero?.pos_y ?? 50) : (hero?.pos_y ?? 50);
  const heroPosition = `${heroPosX}% ${heroPosY}%`;
  const heroFit = isMobile ? (hero?.fit_mobile ?? hero?.fit ?? "cover") : (hero?.fit ?? "cover");
  const heroHeightVh = isMobile ? (hero?.height_mobile ?? 78) : (hero?.height_desktop ?? 78);
  const heroScale = isMobile ? (hero?.scale_mobile ?? hero?.scale ?? 1.05) : (hero?.scale ?? 1.05);
  const heroSectionStyle: CSSProperties = {
    height: `${heroHeightVh}vh`,
    minHeight: isMobile ? 380 : 560,
  };

  useMediaPreload(heroVideo, heroPoster);

  // Persistent local cache: serve hero video & poster from the browser's
  // Cache Storage on repeat visits (0ms), while keeping cloud as source of truth.
  const cachedHeroPoster = useCachedMedia(heroPoster);
  const heroVideoSrc = heroVideoRetry > 0 && heroVideo ? `${heroVideo}${heroVideo.includes("?") ? "&" : "?"}retry=${heroVideoRetry}` : heroVideo;
  const heroPosterSrc = cachedHeroPoster || heroPoster;

  // Warm cache for carousel slides + prune deleted assets on every settings load.
  useEffect(() => {
    const keep = [heroVideo, hero?.image, ...slides].filter(Boolean) as string[];
    warmMediaCache([hero?.image, ...slides]);
    void pruneMediaCache(keep);
  }, [heroVideo, hero?.image, slides]);

  // Never download the large hero video in a hidden background request while
  // the visible <video> is trying to stream. Cache it only after playback has
  // already started, so first load gets all bandwidth.
  useEffect(() => {
    if (!heroVideoReady || !isDirectHeroVideo || !heroVideo) return;
    const id = setTimeout(() => warmMediaCache([heroVideo], { includeVideos: true }), 6000);
    return () => clearTimeout(id);
  }, [heroVideoReady, isDirectHeroVideo, heroVideo]);

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
        settingsQ.refetch();
        collectionsQ.refetch();
      }),
    [collectionsQ, settingsQ],
  );
  useEffect(() => {
    setHeroVideoReady(false);
    setHeroVideoFailed(false);
    setHeroVideoRetry(0);
  }, [heroVideo]);
  useEffect(() => {
    const video = heroVideoRef.current;
    if (!video || !isDirectHeroVideo || heroVideoFailed) return;

    video.load();
    const playPromise = video.play();
    if (playPromise) playPromise.catch(() => undefined);
    if (video.readyState >= 2) setHeroVideoReady(true);
  }, [heroVideoSrc, isDirectHeroVideo, heroVideoFailed]);
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
    collectionsQ.refetch();
  });
  useRealtime(rtReady ? "categories" : "", () => {
    clearAppDataCaches();
    collectionsQ.refetch();
  });
  useRealtime(rtReady ? "store_settings" : "", () => {
    clearAppDataCaches();
    settingsQ.refetch();
    collectionsQ.refetch();
  });

  return (
    <PublicLayout>
      {/* Hero */}
      {!hero ? (
        <section className="relative h-[78vh] min-h-[560px] bg-muted animate-pulse" />
      ) : (
        <section
          className="relative flex items-center justify-center overflow-hidden bg-muted"
          style={{
            ...heroSectionStyle,
            ...(heroVideo && heroPoster
              ? {
                  backgroundImage: `url(${heroPosterSrc})`,
                  backgroundSize: heroFit,
                  backgroundPosition: heroPosition,
                  backgroundRepeat: "no-repeat",
                  backgroundColor: "hsl(var(--muted))",
                }
              : {}),
          }}
        >
          {isDirectHeroVideo ? (
            <video
              key={heroVideoSrc}
              ref={heroVideoRef}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              poster={heroPosterSrc || undefined}
              onLoadedData={() => setHeroVideoReady(true)}
              onCanPlay={() => setHeroVideoReady(true)}
              onPlaying={() => setHeroVideoReady(true)}
              onError={() => {
                if (heroVideoRetry < 1) {
                  window.setTimeout(() => setHeroVideoRetry((n) => n + 1), 700);
                  return;
                }
                setHeroVideoFailed(true);
              }}
              className={`absolute inset-0 w-full h-full transition-opacity duration-200 ${heroVideoReady && !heroVideoFailed ? "opacity-100" : "opacity-0"}`}
              style={{
                objectFit: heroFit,
                objectPosition: heroPosition,
                transform: `scale(${heroScale})`,
              }}
            >
              <source src={heroVideoSrc} type={getVideoMimeType(heroVideoSrc)} />
            </video>
          ) : heroVideo ? (
            <iframe
              src={toEmbedUrl(heroVideo)}
              title="Hero video"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              loading="eager"
              className="absolute inset-0 w-[177.78vh] min-w-full h-[56.25vw] min-h-full -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2 pointer-events-none"
              style={{ transform: `translate(-50%, -50%) scale(${heroScale})` }}
            />
          ) : (
            <img
              src={heroPosterSrc || optimizeImg(hero.image, { w: 1920, q: 75 })}
              srcSet={heroPosterSrc ? undefined : srcSet(hero.image, 1280, 75)}
              sizes="100vw"
              alt="Hero"
              fetchPriority="high"
              decoding="async"
              className="absolute inset-0 w-full h-full"
              style={{
                objectFit: heroFit,
                objectPosition: heroPosition,
                transform: `scale(${heroScale})`,
              }}
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
