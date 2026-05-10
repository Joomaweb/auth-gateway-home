import { Link } from "@tanstack/react-router";

export type ProductCardData = {
  id: string;
  name: string;
  price: number;
  sale_price: number | null;
  images: string[] | null;
};

export function ProductCard({ p }: { p: ProductCardData }) {
  const img = p.images?.[0] ?? "https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=600";
  const onSale = p.sale_price && p.sale_price < p.price;
  return (
    <Link
      to="/product/$id"
      params={{ id: p.id }}
      className="group block"
    >
      <div className="aspect-[3/4] overflow-hidden rounded-md bg-muted relative">
        <img
          src={img}
          alt={p.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {onSale && (
          <span className="absolute top-3 start-3 bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded">
            SALE
          </span>
        )}
      </div>
      <div className="mt-3 flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium leading-snug">{p.name}</h3>
        <div className="text-sm whitespace-nowrap">
          {onSale ? (
            <>
              <span className="text-destructive font-semibold">${p.sale_price?.toFixed(2)}</span>{" "}
              <span className="text-muted-foreground line-through text-xs">
                ${p.price.toFixed(2)}
              </span>
            </>
          ) : (
            <span className="font-semibold">${p.price.toFixed(2)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
