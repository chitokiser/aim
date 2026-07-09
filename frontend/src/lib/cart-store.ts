import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  productId: string;
  variantVid: string | null;
  quantity: number;
  addedAt: string;
}

interface CartState {
  items: CartItem[];
  addItem: (productId: string, variantVid: string | null, quantity: number) => void;
  removeItem: (productId: string, variantVid: string | null) => void;
  setQuantity: (productId: string, variantVid: string | null, quantity: number) => void;
  clear: () => void;
}

function sameLine(a: CartItem, productId: string, variantVid: string | null) {
  return a.productId === productId && a.variantVid === variantVid;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (productId, variantVid, quantity) =>
        set((state) => {
          const existing = state.items.find((i) => sameLine(i, productId, variantVid));
          if (existing) {
            return {
              items: state.items.map((i) =>
                sameLine(i, productId, variantVid) ? { ...i, quantity: i.quantity + quantity } : i
              ),
            };
          }
          return {
            items: [...state.items, { productId, variantVid, quantity, addedAt: new Date().toISOString() }],
          };
        }),
      removeItem: (productId, variantVid) =>
        set((state) => ({ items: state.items.filter((i) => !sameLine(i, productId, variantVid)) })),
      setQuantity: (productId, variantVid, quantity) =>
        set((state) => ({
          items: state.items.map((i) =>
            sameLine(i, productId, variantVid) ? { ...i, quantity: Math.max(1, quantity) } : i
          ),
        })),
      clear: () => set({ items: [] }),
    }),
    { name: "aim-cart" }
  )
);
