import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { ProductCard, type ProductCardData } from "@/components/product/ProductCard";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { useRealtime } from "@/hooks/use-realtime";

export const Route = createFileRoute("/")({
  component: HomePage,
});

type Category = { id: string; name: string; slug: string; image_url: string | null };
type Hero = { image: string; title: string; subtitle: string; cta_text: string; cta_link: string };

const DEFAULT_HERO: Hero = {
  image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1600",
  title: "Timeless wardrobe staples.",
  subtitle: "Modern essentials, classic silhouettes — crafted to last.",
  cta_text: "Shop now",
  cta_link: "/shop",
};

function HomePage() {
  const { t } = useT();
  const [featured, setFeatured] = useState<ProductCardData[]>([]);
  const [sale, setSale] = useState<ProductCardData[]>([]);
  const [newest, setNewest] = useState<ProductCardData[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [hero, setHero] = useState<Hero>(DEFAULT_HERO);
  const [heroVideo, setHeroVideo] = useState<string>("");
  const [slides, setSlides] = useState<string[]>([]);

  const load = () => {
    supabase.from("products")
      .select("id,name,price,sale_price,images,featured")
      .eq("active", true).eq("featured", true).limit(12)
      .then(({ data }) => setFeatured((data ?? []) as ProductCardData[]));
    supabase.from("products")
      .select("id,name,price,sale_price,images")
      .eq("active", true).not("sale_price", "is", null).limit(8)
      .then(({ data }) => setSale((data ?? []) as ProductCardData[]));
    supabase.from("products")
      .select("id,name,price,sale_price,images,created_at")
      .eq("active", true).order("created_at", { ascending: false }).limit(6)
      .then(({ data }) => setNewest((data ?? []) as ProductCardData[]));
    supabase.from("categories").select("*")
      .then(({ data }) => setCats((data ?? []) as Category[]));
    supabase.from("store_settings").select("hero,hero_video,carousel_images").eq("id", 1).maybeSingle()
      .then(({ data }) => {
        if (data?.hero) setHero({ ...DEFAULT_HERO, ...(data.hero as Hero) });
        setHeroVideo((data as { hero_video?: string } | null)?.hero_video ?? "");
        if (Array.isArray(data?.carousel_images)) setSlides(data.carousel_images as string[]);
      });
  };
  useEffect(load, []);
  useRealtime("products", load);
  useRealtime("categories", load);
  useRealtime("store_settings", load);

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative h-[78vh] min-h-[560px] flex items-center justify-center overflow-hidden bg-muted">
        {heroVideo && !/youtube\.com|youtu\.be|vimeo\.com/i.test(heroVideo) ? (
          <video src={heroVideo} autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover scale-105" />
        ) : (
          <img src={hero.image} alt="Hero" className="absolute inset-0 w-full h-full object-cover scale-105" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-background/10" />
        <div className="absolute inset-0 opacity-[0.07] mix-blend-overlay" style={{ backgroundImage: "linear-gradient(oklch(0.18 0.005 60) 1px, transparent 1px), linear-gradient(90deg, oklch(0.18 0.005 60) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        <div className="absolute -top-32 -right-24 w-[420px] h-[420px] rounded-full bg-gradient-gold opacity-30 blur-3xl animate-float-slow" />
        <div className="relative z-10 text-center px-4 max-w-3xl animate-fade-up">
          <span className="inline-flex items-center gap-2 text-[10px] tracking-[0.4em] uppercase text-gold font-semibold mb-5 px-3 py-1 rounded-full glass-panel">
            <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse" /> Atelier · 2026
          </span>
          <h1 className="font-display text-5xl md:text-7xl font-semibold tracking-tight text-gradient-gold">{hero.title}</h1>
          <div className="hairline-gold w-40 mx-auto my-5" />
          <p className="text-lg text-foreground/75 max-w-xl mx-auto">{hero.subtitle}</p>
          <Button asChild size="lg" className="mt-8 ring-gold-soft bg-gradient-gold text-gold-foreground hover:opacity-90">
            <a href={hero.cta_link}>{hero.cta_text}</a>
          </Button>
        </div>
      </section>

      {/* Promo carousel */}
      {slides.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-10">
          <Carousel opts={{ loop: true }}>
            <CarouselContent>
              {slides.map((src, i) => (
                <CarouselItem key={i}>
                  <div className="aspect-[16/6] rounded-lg overflow-hidden bg-muted">
                    <img src={src} alt="" className="w-full h-full object-cover" />
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
          <h2 className="font-display text-2xl md:text-3xl font-semibold mb-6 md:mb-8">{t("home.categories")}</h2>
          {/* Mobile carousel */}
          <div className="md:hidden">
            <Carousel opts={{ align: "start" }}>
              <CarouselContent className="-ms-3">
                {cats.map((c) => (
                  <CarouselItem key={c.id} className="ps-3 basis-3/4 sm:basis-1/2">
                    <Link to="/shop" search={{ category: c.slug }}
                      className="group relative block aspect-[4/3] overflow-hidden rounded-xl bg-muted shadow-soft">
                      <img src={c.image_url ?? "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800"}
                        alt={c.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent flex items-end p-4">
                        <h3 className="text-white font-display text-xl font-semibold drop-shadow">{c.name}</h3>
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
              <Link key={c.id} to="/shop" search={{ category: c.slug }}
                className="group relative aspect-[4/3] overflow-hidden rounded-lg bg-muted">
                <img src={c.image_url ?? "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800"}
                  alt={c.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
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
          <h2 className="font-display text-2xl md:text-3xl font-semibold mb-6 md:mb-8">{t("home.newArrivals")}</h2>
          <Carousel opts={{ align: "start" }}>
            <CarouselContent className="-ms-3 md:-ms-4">
              {newest.map((p) => (
                <CarouselItem key={p.id} className="ps-3 md:ps-4 basis-1/2 sm:basis-1/3 md:basis-1/4 lg:basis-1/5">
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
      {featured.length > 0 && (
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
      {sale.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-16 border-t">
          <h2 className="font-display text-3xl font-semibold mb-8">{t("home.sale")}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
            {sale.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        </section>
      )}
    </PublicLayout>
  );
}
