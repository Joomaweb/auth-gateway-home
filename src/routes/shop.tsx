import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { ProductCard, type ProductCardData } from "@/components/product/ProductCard";
import { useT } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRealtime } from "@/hooks/use-realtime";
import { ChevronRight } from "lucide-react";

type Search = { category?: string; sort?: string };

export const Route = createFileRoute("/shop")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    category: typeof s.category === "string" ? s.category : undefined,
    sort: typeof s.sort === "string" ? s.sort : undefined,
  }),
  component: ShopPage,
});

type Cat = { id: string; name: string; slug: string; image_url: string | null; parent_id: string | null };

function ShopPage() {
  const { t } = useT();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCats = () =>
    supabase
      .from("categories")
      .select("id,name,slug,image_url,parent_id")
      .order("name")
      .then(({ data }) => setCats((data ?? []) as Cat[]));

  useEffect(() => {
    loadCats();
  }, []);

  // Derive: current category, its children, breadcrumb
  const current = useMemo(
    () => (search.category ? cats.find((c) => c.slug === search.category) ?? null : null),
    [cats, search.category],
  );
  const children = useMemo(
    () => (current ? cats.filter((c) => c.parent_id === current.id) : cats.filter((c) => !c.parent_id)),
    [cats, current],
  );
  const showSubcategories = !current || children.length > 0;

  const parent = useMemo(
    () => (current?.parent_id ? cats.find((c) => c.id === current.parent_id) ?? null : null),
    [cats, current],
  );

  // Fetch products only when viewing a leaf category (or could also show on top-level — we show subcats instead)
  const fetchProducts = () => {
    if (showSubcategories) {
      setProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let q = supabase
      .from("products")
      .select("id,name,price,sale_price,images,category_id,categories(slug)")
      .eq("active", true);

    if (search.sort === "price_asc") q = q.order("price", { ascending: true });
    else if (search.sort === "price_desc") q = q.order("price", { ascending: false });
    else q = q.order("created_at", { ascending: false });

    q.then(({ data }) => {
      let rows = (data ?? []) as unknown as Array<
        ProductCardData & { categories: { slug: string } | { slug: string }[] | null }
      >;
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
  };

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.category, search.sort, showSubcategories]);

  useRealtime("products", fetchProducts);
  useRealtime("categories", loadCats);

  return (
    <PublicLayout>
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <nav className="text-sm text-muted-foreground flex items-center gap-1.5 mb-2">
              <Link to="/shop" search={{}} className="hover:text-foreground">
                {t("shop.all")}
              </Link>
              {parent && (
                <>
                  <ChevronRight className="h-3.5 w-3.5" />
                  <Link to="/shop" search={{ category: parent.slug }} className="hover:text-foreground">
                    {parent.name}
                  </Link>
                </>
              )}
              {current && (
                <>
                  <ChevronRight className="h-3.5 w-3.5" />
                  <span className="text-foreground">{current.name}</span>
                </>
              )}
            </nav>
            <h1 className="font-display text-4xl font-semibold">
              {current ? current.name : t("shop.title")}
            </h1>
          </div>
          {!showSubcategories && (
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
          )}
        </div>

        {showSubcategories ? (
          children.length === 0 ? (
            <p className="text-muted-foreground py-12 text-center">{t("shop.empty")}</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8 mt-6">
              {children.map((c) => (
                <Link
                  key={c.id}
                  to="/shop"
                  search={{ category: c.slug }}
                  className="group block"
                >
                  <div className="aspect-square overflow-hidden bg-muted rounded-md">
                    {c.image_url ? (
                      <img
                        src={c.image_url}
                        alt={c.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                        {c.name}
                      </div>
                    )}
                  </div>
                  <h3 className="mt-3 text-center font-medium tracking-wide uppercase text-sm">
                    {c.name}
                  </h3>
                </Link>
              ))}
            </div>
          )
        ) : loading ? (
          <p className="text-muted-foreground">{t("common.loading")}</p>
        ) : products.length === 0 ? (
          <p className="text-muted-foreground">{t("shop.empty")}</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
            {products.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
