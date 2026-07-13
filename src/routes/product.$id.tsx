import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { useT } from "@/lib/i18n";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useRealtime } from "@/hooks/use-realtime";
import { optimizeImg, srcSet } from "@/lib/img";
import { invalidateRunCache, run } from "@/lib/api";
import { subscribeAppDataChanges } from "@/lib/realtime-sync";
import { getVideoMimeType, isDirectVideoUrl, toEmbedUrl } from "@/lib/media";
import { useMediaPreload } from "@/hooks/use-media-preload";

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

async function fetchProductDetail(
  id: string,
): Promise<{ product: Product | null; variants: Variant[] }> {
  const [productRes, variantsRes] = await Promise.all([
    run({ key: `product:${id}:detail`, timeoutMs: 5000, attempts: 2, cacheMs: 2 * 60_000 }, () =>
      supabase
        .from("products")
        .select(
          "id,name,description,price,sale_price,images,video_url,video_size,requires_stock_approval",
        )
        .eq("id", id)
        .maybeSingle(),
    ),
    run({ key: `product:${id}:variants`, timeoutMs: 5000, attempts: 2, cacheMs: 2 * 60_000 }, () =>
      supabase.from("product_variants").select("id,size,color,stock").eq("product_id", id),
    ),
  ]);
  if (productRes.error) throw productRes.error;
  if (variantsRes.error) throw variantsRes.error;
  return {
    product: (productRes.data ?? null) as Product | null,
    variants: (variantsRes.data ?? []) as Variant[],
  };
}

function ProductPage() {
  const { id } = Route.useParams();
  const { t } = useT();
  const navigate = useNavigate();
  const add = useCart((s) => s.add);
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [imgIdx, setImgIdx] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const productQ = useQuery({
    queryKey: ["product", id],
    queryFn: () => fetchProductDetail(id),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: true,
  });
  const product = productQ.data?.product ?? null;
  const variants = productQ.data?.variants ?? [];
  const productVideoUrl = product?.video_url?.trim() ?? "";
  const productPoster = product?.images?.[0]
    ? optimizeImg(product.images[0], { w: 1200, q: 70 })
    : "";

  useMediaPreload(productVideoUrl, productPoster);

  useEffect(() => {
    setShowVideo(false);
    setVideoReady(false);
    setImgIdx(0);
    setSize(null);
    setColor(null);
  }, [id]);
  useEffect(() => {
    if (productVideoUrl) setShowVideo(true);
  }, [productVideoUrl]);
  useEffect(() => {
    setVideoReady(false);
  }, [productVideoUrl]);
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isDirectVideoUrl(productVideoUrl)) return;

    video.load();
    const playPromise = video.play();
    if (playPromise) playPromise.catch(() => undefined);
    if (video.readyState >= 2) setVideoReady(true);
  }, [productVideoUrl]);
  useEffect(
    () =>
      subscribeAppDataChanges(() => {
        invalidateRunCache(`product:${id}:`);
        productQ.refetch();
      }),
    [id, productQ],
  );
  useRealtime(
    "products",
    () => {
      invalidateRunCache(`product:${id}:`);
      productQ.refetch();
    },
    `id=eq.${id}`,
  );
  useRealtime(
    "product_variants",
    () => {
      invalidateRunCache(`product:${id}:`);
      productQ.refetch();
    },
    `product_id=eq.${id}`,
  );

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
  const hasVideo = !!productVideoUrl;
  const isUploadedVideo = isDirectVideoUrl(productVideoUrl);
  const isEmbeddedVideo = hasVideo && !isUploadedVideo;

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
          {(() => {
            const sizeMap: Record<string, string> = {
              small: "400px",
              medium: "600px",
              large: "900px",
              full: "100%",
            };
            const maxW = sizeMap[product.video_size ?? "large"] ?? "900px";

            return (
              <>
                <div
                  className="rounded-lg overflow-hidden bg-muted mx-auto"
                  style={{
                    maxWidth: showVideo && hasVideo ? maxW : undefined,
                    backgroundImage:
                      showVideo && productPoster ? `url(${productPoster})` : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  {showVideo && isUploadedVideo ? (
                    <video
                      ref={videoRef}
                      src={productVideoUrl}
                      controls
                      autoPlay
                      muted
                      playsInline
                      loop
                      preload="auto"
                      poster={productPoster || undefined}
                      onLoadedData={() => setVideoReady(true)}
                      onCanPlay={() => setVideoReady(true)}
                      onPlaying={() => setVideoReady(true)}
                      className={`w-full aspect-video bg-muted transition-opacity duration-200 ${videoReady || !productPoster ? "opacity-100" : "opacity-0"}`}
                    >
                      <source src={productVideoUrl} type={getVideoMimeType(productVideoUrl)} />
                    </video>
                  ) : showVideo && isEmbeddedVideo ? (
                    <iframe
                      src={toEmbedUrl(productVideoUrl)}
                      title={`${product.name} video`}
                      allow="autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                      loading="eager"
                      className="w-full aspect-video bg-muted"
                    />
                  ) : (
                    <div className="aspect-[3/4]">
                      <img
                        src={optimizeImg(images[imgIdx], { w: 900, q: 75 })}
                        srcSet={srcSet(images[imgIdx], 900, 75)}
                        sizes="(max-width: 768px) 100vw, 50vw"
                        alt={product.name}
                        fetchPriority="high"
                        decoding="async"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>

                {(images.length > 1 || hasVideo) && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {images.map((src, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setShowVideo(false);
                          setImgIdx(i);
                        }}
                        className={cn(
                          "w-16 h-20 rounded overflow-hidden bg-muted border-2",
                          !showVideo && i === imgIdx ? "border-primary" : "border-transparent",
                        )}
                      >
                        <img
                          src={optimizeImg(src, { w: 160, q: 70 })}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                    {hasVideo && (
                      <button
                        onClick={() => setShowVideo(true)}
                        className={cn(
                          "relative w-16 h-20 rounded overflow-hidden bg-black border-2 flex items-center justify-center",
                          showVideo ? "border-primary" : "border-transparent",
                        )}
                        aria-label="Play video"
                      >
                        <img
                          src={optimizeImg(images[0], { w: 160, q: 60 })}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="absolute inset-0 w-full h-full object-cover opacity-70"
                        />
                        <svg
                          viewBox="0 0 24 24"
                          className="relative h-6 w-6 text-white drop-shadow"
                          fill="currentColor"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </>
            );
          })()}
        </div>

        <div>
          <h1 className="font-display text-4xl font-semibold">{product.name}</h1>
          <div className="mt-3 text-2xl">
            {product.sale_price ? (
              <>
                <span className="text-destructive font-semibold">
                  ${product.sale_price.toFixed(2)}
                </span>
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

          {product.video_url && /youtube\.com|youtu\.be|vimeo\.com/i.test(product.video_url) && (
            <a
              href={product.video_url}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block text-sm underline text-primary"
            >
              Watch product video ↗
            </a>
          )}

          {product.requires_stock_approval && (
            <div className="mt-4 border border-amber-500/40 bg-amber-500/10 rounded-lg p-3 text-sm">
              <strong>Note:</strong> This item is subject to stock approval — your order will only
              be processed after confirmation.
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
          <Button
            size="lg"
            variant="outline"
            className="mt-2 w-full"
            onClick={() => navigate({ to: "/cart" })}
          >
            {t("nav.cart")}
          </Button>
        </div>
      </div>
    </PublicLayout>
  );
}
