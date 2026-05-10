import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { ProductCard, type ProductCardData } from "@/components/product/ProductCard";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

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
  const [cats, setCats] = useState<Category[]>([]);
  const [hero, setHero] = useState<Hero>(DEFAULT_HERO);
  const [slides, setSlides] = useState<string[]>([]);

  useEffect(() => {
    supabase.from("products")
      .select("id,name,price,sale_price,images,featured")
      .eq("active", true).eq("featured", true).limit(12)
      .then(({ data }) => setFeatured((data ?? []) as ProductCardData[]));
    supabase.from("products")
      .select("id,name,price,sale_price,images")
      .eq("active", true).not("sale_price", "is", null).limit(8)
      .then(({ data }) => setSale((data ?? []) as ProductCardData[]));
    supabase.from("categories").select("*")
      .then(({ data }) => setCats((data ?? []) as Category[]));
    supabase.from("store_settings").select("hero,carousel_images").eq("id", 1).maybeSingle()
      .then(({ data }) => {
        if (data?.hero) setHero({ ...DEFAULT_HERO, ...(data.hero as Hero) });
        if (Array.isArray(data?.carousel_images)) setSlides(data.carousel_images as string[]);
      });
  }, []);

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative h-[70vh] min-h-[500px] flex items-center justify-center overflow-hidden bg-muted">
        <img src={hero.image} alt="Hero" className="absolute inset-0 w-full h-full object-cover opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-background/20 to-transparent" />
        <div className="relative z-10 text-center px-4 max-w-3xl">
          <h1 className="font-display text-5xl md:text-7xl font-semibold tracking-tight">{hero.title}</h1>
          <p className="mt-4 text-lg text-foreground/80">{hero.subtitle}</p>
          <Button asChild size="lg" className="mt-8">
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
        <section className="max-w-7xl mx-auto px-4 py-16">
          <h2 className="font-display text-3xl font-semibold mb-8">{t("home.categories")}</h2>
          <div className="grid gap-4 md:grid-cols-3">
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
