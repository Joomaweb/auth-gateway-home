import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { useT } from "@/lib/i18n";
import { Trash2, Plus, Minus } from "lucide-react";

export const Route = createFileRoute("/cart")({
  component: CartPage,
});

function CartPage() {
  const { t } = useT();
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const subtotal = items.reduce((n, i) => n + i.qty * i.price, 0);

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="font-display text-4xl font-semibold mb-8">{t("cart.title")}</h1>

        {items.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground mb-6">{t("cart.empty")}</p>
            <Button asChild>
              <Link to="/shop">{t("cart.continue")}</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              {items.map((i) => (
                <div
                  key={`${i.productId}-${i.variantId}`}
                  className="flex gap-4 border rounded-lg p-4 bg-card"
                >
                  <img src={i.image} alt={i.name} className="w-24 h-32 object-cover rounded" />
                  <div className="flex-1 min-w-0">
                    <Link to="/product/$id" params={{ id: i.productId }} className="font-medium hover:underline">
                      {i.name}
                    </Link>
                    <div className="text-xs text-muted-foreground mt-1">
                      {i.size && <span>{t("product.size")}: {i.size}</span>}
                      {i.size && i.color && " · "}
                      {i.color && <span>{t("product.color")}: {i.color}</span>}
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex items-center border rounded">
                        <button
                          onClick={() => setQty(i.productId, i.variantId, i.qty - 1)}
                          className="px-2 py-1 hover:bg-muted"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="px-3 text-sm">{i.qty}</span>
                        <button
                          onClick={() => setQty(i.productId, i.variantId, i.qty + 1)}
                          className="px-2 py-1 hover:bg-muted"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <button
                        onClick={() => remove(i.productId, i.variantId)}
                        className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
                      >
                        <Trash2 className="h-3 w-3" /> {t("cart.remove")}
                      </button>
                    </div>
                  </div>
                  <div className="text-right font-semibold">
                    ${(i.qty * i.price).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            <div className="border rounded-lg p-6 bg-card h-fit space-y-4 sticky top-20">
              <div className="flex justify-between text-sm">
                <span>{t("cart.subtotal")}</span>
                <span className="font-semibold">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{t("cart.shipping")}</span>
                <span>—</span>
              </div>
              <div className="border-t pt-4 flex justify-between text-lg">
                <span className="font-medium">{t("cart.total")}</span>
                <span className="font-bold">${subtotal.toFixed(2)}</span>
              </div>
              <Button asChild className="w-full" size="lg">
                <Link to="/checkout">{t("cart.checkout")}</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
