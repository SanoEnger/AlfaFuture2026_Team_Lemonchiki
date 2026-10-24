import type { Product } from "./types";
export const products: Product[] = [];
export const productName = (id: string) =>
  products.find((p) => p.id === id)?.name || "Кредит для бизнеса";
