import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  productId: string;
  variantId: string | null;
  name: string;
  image: string;
  price: number;
  size: string | null;
  color: string | null;
  qty: number;
};

type CartState = {
  items: CartItem[];
  add: (item: CartItem) => void;
  remove: (productId: string, variantId: string | null) => void;
  setQty: (productId: string, variantId: string | null, qty: number) => void;
  clear: () => void;
  count: () => number;
  subtotal: () => number;
};

const key = (i: { productId: string; variantId: string | null }) =>
  `${i.productId}::${i.variantId ?? ""}`;

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item) =>
        set((s) => {
          const k = key(item);
          const existing = s.items.find((i) => key(i) === k);
          if (existing) {
            return {
              items: s.items.map((i) =>
                key(i) === k ? { ...i, qty: i.qty + item.qty } : i,
              ),
            };
          }
          return { items: [...s.items, item] };
        }),
      remove: (productId, variantId) =>
        set((s) => ({
          items: s.items.filter(
            (i) => !(i.productId === productId && i.variantId === variantId),
          ),
        })),
      setQty: (productId, variantId, qty) =>
        set((s) => ({
          items: s.items
            .map((i) =>
              i.productId === productId && i.variantId === variantId
                ? { ...i, qty: Math.max(1, qty) }
                : i,
            ),
        })),
      clear: () => set({ items: [] }),
      count: () => get().items.reduce((n, i) => n + i.qty, 0),
      subtotal: () => get().items.reduce((n, i) => n + i.qty * i.price, 0),
    }),
    { name: "cart-v1" },
  ),
);
