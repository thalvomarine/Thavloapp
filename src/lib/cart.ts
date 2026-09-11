import { useEffect, useState } from "react";

export interface CartItem {
  part_id: string;
  name: string;
  price: number;
  qty: number;
  image_url: string | null;
  brand: string;
}

const KEY = "thalvo.cart.v1";

function read(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}
function write(items: CartItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("thalvo:cart"));
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  useEffect(() => {
    setItems(read());
    const h = () => setItems(read());
    window.addEventListener("thalvo:cart", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("thalvo:cart", h);
      window.removeEventListener("storage", h);
    };
  }, []);

  const add = (it: Omit<CartItem, "qty">, qty = 1) => {
    const next = [...read()];
    const idx = next.findIndex((x) => x.part_id === it.part_id);
    if (idx >= 0) next[idx].qty += qty;
    else next.push({ ...it, qty });
    write(next);
  };
  const remove = (part_id: string) => write(read().filter((x) => x.part_id !== part_id));
  const setQty = (part_id: string, qty: number) => {
    const next = read().map((x) => (x.part_id === part_id ? { ...x, qty: Math.max(1, qty) } : x));
    write(next);
  };
  const clear = () => write([]);
  const total = items.reduce((s, x) => s + x.price * x.qty, 0);
  const count = items.reduce((s, x) => s + x.qty, 0);
  return { items, add, remove, setQty, clear, total, count };
}
