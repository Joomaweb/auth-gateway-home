import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { ProductCard, type ProductCardData } from "@/components/product/ProductCard";
import { useT } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRealtime } from "@/hooks/use-realtime";
import { ChevronRight } from "lucide-react";
import { optimizeImg, srcSet } from "@/lib/img";
import { invalidateRunCache, run } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { clearAppDataCaches, subscribeAppDataChanges } from "@/lib/realtime-sync";

type Search = { category?: string; sort?: string };

export const Route = createFileRoute("/shop")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    category: typeof s.category === "string" ? s.category : undefined,
    sort: typeof s.sort === "string" ? s.sort : undefined,
  }),
  component: ShopPage,
});

type Cat = { id: string; name: string; slug: string; image_url: string | null; parent_id: string | null };
type ProductRow = ProductCardData & { category_id: string | null; categories: { slug: string } | { slug: string }[] | null };

const CATS_CACHE = "shop:cats:v1";
const PROD_CACHE = "shop:prods:v1";
const TTL = 10 * 60_000;
const PAGE_SIZE = 48;

function readCache<T>(key: string): T | undefined {
  if (typeof localStorage === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const { t, d } = JSON.parse(raw) as { t: number; d: T };
    if (Date.now() - t > TTL) return undefined;
    return d;
  } catch { return undefined; }
}
function writeCache<T>(key: string, d: T) {
  try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), d })); } catch { /* ignore */ }
}

async function fetchCats(): Promise<Cat[]> {
  const { data } = await run({ key: "shop:cats", timeoutMs: 5000, attempts: 2, cacheMs: 60_000 }, () =>
    supabase
      .from("categories")
      .select("id,name,slug,image_url,parent_id")
      .order("name"),
  );
  const rows = (data ?? []) as Cat[];
  writeCache(CATS_CACHE, rows);
  return rows;
}

async function fetchProducts(sort: string | undefined, categoryId: string | undefined, limit: number): Promise<ProductRow[]> {
  const cacheKey = `shop:prods:${sort ?? "newest"}:${categoryId ?? "all"}:${limit}`;
  const { data } = await run({ key: cacheKey, timeoutMs: 6000, attempts: 2, cacheMs: 60_000 }, () => {
    let q = supabase
      .from("products")
      .select("id,name,price,sale_price,images,category_id,categories(slug)")
      .eq("active", true);
    if (categoryId) q = q.eq("category_id", categoryId);
    if (sort === "price_asc") q = q.order("price", { ascending: true });
    else if (sort === "price_desc") q = q.order("price", { ascending: false });
    else q = q.order("created_at", { ascending: false });
    return q.limit(limit);
  });
  const rows = (data ?? []) as unknown as ProductRow[];
  writeCache(`${PROD_CACHE}:${sort ?? "newest"}:${categoryId ?? "all"}:${limit}`, rows);
  return rows;
}

function ShopPage() {
  const { t } = useT();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const [initialCats] = useState(() => readCache<Cat[]>(CATS_CACHE));
  const catsQ = useQuery({
    queryKey: ["shop", "cats"],
    queryFn: fetchCats,
    initialData: initialCats,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: true,
  });
  const cats = catsQ.data ?? [];

  const sortKey = search.sort ?? "newest";
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
  const productCategoryId = current?.id;
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  useEffect(() => setPageSize(PAGE_SIZE), [search.category, sortKey]);
  const productCacheKey = `${PROD_CACHE}:${sortKey}:${productCategoryId ?? "all"}:${pageSize}`;
  const prodQ = useQuery({
    queryKey: ["shop", "products", sortKey, productCategoryId ?? "all", pageSize],
    queryFn: () => fetchProducts(search.sort, productCategoryId, pageSize),
    initialData: () => readCache<ProductRow[]>(productCacheKey),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: true,
    enabled: !showSubcategories,
  });
  const allProducts = prodQ.data ?? [];
  const loading = prodQ.isLoading && !prodQ.data;

  // Defer realtime until after first paint.
  const [rtReady, setRtReady] = useState(false);
  useEffect(() => { const id = setTimeout(() => setRtReady(true), 1500); return () => clearTimeout(id); }, []);
  useEffect(() => subscribeAppDataChanges(() => {
    clearAppDataCaches();
    catsQ.refetch();
    if (!showSubcategories) prodQ.refetch();
  }), [catsQ, prodQ, showSubcategories]);
  useRealtime(rtReady && !showSubcategories ? "products" : "", () => {
    clearAppDataCaches();
    prodQ.refetch();
  });
  useRealtime(rtReady ? "categories" : "", () => {
    clearAppDataCaches();
    catsQ.refetch();
  });

  const products = useMemo(() => {
    return showSubcategories ? [] : allProducts;
  }, [allProducts, showSubcategories]);

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
                        src={optimizeImg(c.image_url, { w: 400 })}
                        srcSet={srcSet(c.image_url, 400)}
                        sizes="(max-width: 768px) 50vw, 25vw"
                        alt={c.name}
                        loading="lazy"
                        decoding="async"
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
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
              {products.map((p) => (
                <ProductCard key={p.id} p={p} />
              ))}
            </div>
            {products.length >= pageSize && (
              <div className="flex justify-center mt-10">
                <Button variant="outline" onClick={() => setPageSize((n) => n + PAGE_SIZE)} disabled={prodQ.isFetching}>
                  {prodQ.isFetching ? t("common.loading") : "Load more"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </PublicLayout>
  );
}
