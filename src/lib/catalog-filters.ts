export const catalogSorts = [
  "newest",
  "price-asc",
  "price-desc",
  "name",
] as const;
export type CatalogSort = (typeof catalogSorts)[number];
export function parseCatalogFilters(
  search: Record<string, string | undefined>,
) {
  const price = (value?: string) => {
    if (!value?.trim()) return undefined;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 && n <= 9999999999 ? n : undefined;
  };
  let minPrice = price(search.min),
    maxPrice = price(search.max);
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice)
    [minPrice, maxPrice] = [maxPrice, minPrice];
  return {
    minPrice,
    maxPrice,
    size: (search.size || "").trim().slice(0, 30),
    color: (search.color || "").trim().slice(0, 50),
    inStock: search.stock === "1",
    onSale: search.sale === "1",
    sort: catalogSorts.includes(search.sort as CatalogSort)
      ? (search.sort as CatalogSort)
      : ("newest" as CatalogSort),
  };
}
export function catalogRange(page = 1, size = 24) {
  const safePage =
    Number.isSafeInteger(page) && page > 0 ? Math.min(page, 100000) : 1;
  const safeSize =
    Number.isSafeInteger(size) && size > 0 ? Math.min(size, 100) : 24;
  return [(safePage - 1) * safeSize, safePage * safeSize - 1] as const;
}
