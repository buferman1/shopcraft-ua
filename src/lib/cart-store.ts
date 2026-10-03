"use client";
import { useSyncExternalStore } from "react";
import { cartSchema, type CartItem, putCartItem } from "./commerce";
const empty: CartItem[] = [];
const cache = new Map<string, { raw: string | null; items: CartItem[] }>();
const key = (storeId: string) => `shopcraft:cart:v1:${storeId}`;
function snapshot(storeId: string): CartItem[] {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key(storeId));
  } catch {
    return empty;
  }
  const old = cache.get(storeId);
  if (old && old.raw === raw) return old.items;
  let items = empty;
  try {
    const parsed = cartSchema.safeParse(JSON.parse(raw || "[]"));
    if (parsed.success) items = parsed.data;
  } catch {}
  cache.set(storeId, { raw, items });
  return items;
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("shopcraft-cart", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("shopcraft-cart", callback);
  };
}
export function writeCart(storeId: string, items: CartItem[]) {
  localStorage.setItem(key(storeId), JSON.stringify(cartSchema.parse(items)));
  window.dispatchEvent(new Event("shopcraft-cart"));
}
export function addToCart(storeId: string, item: CartItem) {
  writeCart(storeId, putCartItem(snapshot(storeId), item));
}
export function useCart(storeId: string) {
  return useSyncExternalStore(
    subscribe,
    () => snapshot(storeId),
    () => empty,
  );
}
