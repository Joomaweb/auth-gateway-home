import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { ProductCard, type ProductCardData } from "@/components/product/ProductCard";
import { useT } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRealtime } from "@/hooks/use-realtime";

type Search = { category?: string; sort?: string };

export const Route = createFileRoute("/shop")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    category: typeof s.category === "string" ? s.category : undefined,
    sort: typeof s.sort === "string" ? s.sort : undefined,
  }),
  component: ShopPage,
});

type Cat = { id: string; name: string; slug: string };

function ShopPage() {
  const { t } = useT();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("categories").select("*").then(({ data }) => setCats((data ?? []) as Cat[]));
  }, []);

  useEffect(() => {
    setLoading(true);
    let q = supabase.from("products")
      .select("id,name,price,sale_price,images,category_id,categories(slug)")
      .eq("active", true);

    if (search.sort === "price_asc") q = q.order("price", { ascending: true });
    else if (search.sort === "price_desc") q = q.order("price", { ascending: false });
    else q = q.order("created_at", { ascending: false });

    q.then(({ data }) => {
      let rows = (data ?? []) as unknown as Array<ProductCardData & { categories: { slug: string } | { slug: string }[] | null }>;
      if (search.category) {
        rows = rows.filter((r) => {
          const c = r.categories;
          if (!c) return false;
          return Array.isArray(c) ? c.some((x) => x.slug === search.category) : c.slug === search.category;
        });
      }
      setProducts(rows);
      setLoading(false);
    });
  }, [search.category, search.sort]);

  useRealtime("products", () => {
    // re-trigger fetch by toggling loading; simplest is to refetch via location
    setLoading((l) => l);
    supabase.from("products")
      .select("id,name,price,sale_price,images,category_id,categories(slug)")
      .eq("active", true)
      .then(({ data }) => {
        let rows = (data ?? []) as unknown as Array<ProductCardData & { categories: { slug: string } | { slug: string }[] | null }>;
        if (search.category) {
          rows = rows.filter((r) => {
            const c = r.categories;
            if (!c) return false;
            return Array.isArray(c) ? c.some((x) => x.slug === search.category) : c.slug === search.category;
          });
        }
        setProducts(rows);
      });
  });
  useRealtime("categories", () => {
    supabase.from("categories").select("*").then(({ data }) => setCats((data ?? []) as Cat[]));
  });

  return (
    <PublicLayout>
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <h1 className="font-display text-4xl font-semibold">{t("shop.title")}</h1>
          <Select
            value={search.sort ?? "newest"}
            onValueChange={(v) => navigate({ search: { ...search, sort: v } })}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">{t("shop.newest")}</SelectItem>
              <SelectItem value="price_asc">{t("shop.priceLow")}</SelectItem>
              <SelectItem value="price_desc">{t("shop.priceHigh")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => navigate({ search: { ...search, category: undefined } })}
            className={`px-4 py-1.5 rounded-full border text-sm ${!search.category ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            {t("shop.all")}
          </button>
          {cats.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate({ search: { ...search, category: c.slug } })}
              className={`px-4 py-1.5 rounded-full border text-sm ${search.category === c.slug ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-muted-foreground">{t("common.loading")}</p>
        ) : products.length === 0 ? (
          <p className="text-muted-foreground">{t("shop.empty")}</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
            {products.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
