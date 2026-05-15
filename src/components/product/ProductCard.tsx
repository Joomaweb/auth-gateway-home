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
  const img2 = p.images?.[1] ?? img;
  const onSale = p.sale_price && p.sale_price < p.price;
  return (
    <Link to="/product/$id" params={{ id: p.id }} className="group block">
      <div className="aspect-[3/4] overflow-hidden rounded-lg bg-muted relative shadow-soft transition-all duration-500 group-hover:shadow-elegant group-hover:ring-1 group-hover:ring-gold/50">
        <img
          src={img}
          alt={p.name}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover transition-all duration-700 group-hover:opacity-0 group-hover:scale-105"
        />
        <img
          src={img2}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover scale-110 opacity-0 transition-all duration-700 group-hover:opacity-100 group-hover:scale-100"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        {onSale && (
          <span className="absolute top-3 start-3 bg-gradient-gold text-gold-foreground text-[10px] tracking-[0.2em] uppercase font-semibold px-2.5 py-1 rounded-sm shadow-soft">
            Sale
          </span>
        )}
      </div>
      <div className="mt-3 flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium leading-snug tracking-wide group-hover:text-gold transition-colors">
          {p.name}
        </h3>
        <div className="text-sm whitespace-nowrap">
          {onSale ? (
            <>
              <span className="text-foreground font-semibold">${p.sale_price?.toFixed(2)}</span>{" "}
              <span className="text-muted-foreground line-through text-xs">${p.price.toFixed(2)}</span>
            </>
          ) : (
            <span className="font-semibold">${p.price.toFixed(2)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
