import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { useT } from "@/lib/i18n";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useRealtime } from "@/hooks/use-realtime";

export const Route = createFileRoute("/product/$id")({
  component: ProductPage,
});

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  sale_price: number | null;
  images: string[] | null;
  video_url?: string | null;
  video_size?: "small" | "medium" | "large" | "full" | null;
  requires_stock_approval?: boolean | null;
};
type Variant = { id: string; size: string | null; color: string | null; stock: number };

function ProductPage() {
  const { id } = Route.useParams();
  const { t } = useT();
  const navigate = useNavigate();
  const add = useCart((s) => s.add);
  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [imgIdx, setImgIdx] = useState(0);

  const load = () => {
    supabase.from("products").select("*").eq("id", id).maybeSingle().then(({ data }) => setProduct(data));
    supabase.from("product_variants").select("*").eq("product_id", id).then(({ data }) =>
      setVariants((data ?? []) as Variant[]),
    );
  };
  useEffect(load, [id]);
  useRealtime("products", load, `id=eq.${id}`);
  useRealtime("product_variants", load, `product_id=eq.${id}`);

  if (!product) {
    return (
      <PublicLayout>
        <div className="max-w-7xl mx-auto px-4 py-20 text-center text-muted-foreground">
          {t("common.loading")}
        </div>
      </PublicLayout>
    );
  }

  const sizes = Array.from(new Set(variants.map((v) => v.size).filter(Boolean))) as string[];
  const colors = Array.from(new Set(variants.map((v) => v.color).filter(Boolean))) as string[];
  const matched = variants.find(
    (v) => (size ? v.size === size : true) && (color ? v.color === color : true),
  );
  const stock = matched?.stock ?? 0;
  const price = product.sale_price ?? product.price;
  const images = product.images?.length
    ? product.images
    : ["https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=900"];

  const handleAdd = () => {
    if (sizes.length && !size) {
      toast.error("Select a size");
      return;
    }
    if (colors.length && !color) {
      toast.error("Select a color");
      return;
    }
    if (variants.length && !matched) {
      toast.error("Variant unavailable");
      return;
    }
    if (variants.length && stock <= 0) {
      toast.error(t("product.outOfStock"));
      return;
    }
    add({
      productId: product.id,
      variantId: matched?.id ?? null,
      name: product.name,
      image: images[0],
      price,
      size,
      color,
      qty: 1,
    });
    toast.success("Added to cart");
  };

  return (
    <PublicLayout>
      <div className="max-w-7xl mx-auto px-4 py-10 grid gap-10 lg:grid-cols-2">
        <div>
          <div className="aspect-[3/4] rounded-lg overflow-hidden bg-muted">
            <img src={images[imgIdx]} alt={product.name} className="w-full h-full object-cover" />
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 mt-3">
              {images.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setImgIdx(i)}
                  className={cn(
                    "w-16 h-20 rounded overflow-hidden bg-muted border-2",
                    i === imgIdx ? "border-primary" : "border-transparent",
                  )}
                >
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <h1 className="font-display text-4xl font-semibold">{product.name}</h1>
          <div className="mt-3 text-2xl">
            {product.sale_price ? (
              <>
                <span className="text-destructive font-semibold">${product.sale_price.toFixed(2)}</span>
                <span className="text-muted-foreground line-through text-base ms-3">
                  ${product.price.toFixed(2)}
                </span>
              </>
            ) : (
              <span className="font-semibold">${product.price.toFixed(2)}</span>
            )}
          </div>

          {product.description && (
            <p className="mt-6 text-muted-foreground leading-relaxed">{product.description}</p>
          )}

          {product.video_url && !/youtube\.com|youtu\.be|vimeo\.com/i.test(product.video_url) && (
            <div className="mt-6 rounded-lg overflow-hidden border bg-black">
              <video src={product.video_url} controls className="w-full aspect-video" />
            </div>
          )}
          {product.video_url && /youtube\.com|youtu\.be|vimeo\.com/i.test(product.video_url) && (
            <a href={product.video_url} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm underline text-primary">
              Watch product video ↗
            </a>
          )}

          {product.requires_stock_approval && (
            <div className="mt-4 border border-amber-500/40 bg-amber-500/10 rounded-lg p-3 text-sm">
              <strong>Note:</strong> This item is subject to stock approval — your order will only be processed after confirmation.
            </div>
          )}

          {sizes.length > 0 && (
            <div className="mt-6">
              <div className="text-sm font-medium mb-2">{t("product.size")}</div>
              <div className="flex flex-wrap gap-2">
                {sizes.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSize(s)}
                    className={cn(
                      "min-w-12 px-4 py-2 rounded-md border text-sm",
                      size === s ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {colors.length > 0 && (
            <div className="mt-5">
              <div className="text-sm font-medium mb-2">{t("product.color")}</div>
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={cn(
                      "px-4 py-2 rounded-md border text-sm capitalize",
                      color === c ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted",
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {variants.length > 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              {stock > 0 ? `${t("product.inStock")} (${stock})` : t("product.outOfStock")}
            </p>
          )}

          <Button size="lg" className="mt-6 w-full" onClick={handleAdd}>
            {t("product.addToCart")}
          </Button>
          <Button size="lg" variant="outline" className="mt-2 w-full" onClick={() => navigate({ to: "/cart" })}>
            {t("nav.cart")}
          </Button>
        </div>
      </div>
    </PublicLayout>
  );
}
