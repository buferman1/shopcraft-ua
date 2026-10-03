import "server-only";
import { catalogRange, type CatalogSort } from "./catalog-filters";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogProduct, CatalogCategory } from "./design";

// Only fields intended for a shopper are passed to the storefront renderer.
export async function loadCatalog(
  client: SupabaseClient,
  storeId: string,
  options: {
    page?: number;
    pageSize?: number;
    query?: string;
    categoryId?: string;
    minPrice?: number;
    maxPrice?: number;
    size?: string;
    color?: string;
    inStock?: boolean;
    onSale?: boolean;
    sort?: CatalogSort;
  } = {},
) {
  const range = catalogRange(options.page || 1, options.pageSize || 100);
  const variants = Boolean(options.size || options.color || options.inStock);
  let query = client
    .from("products")
    .select(
      "id,name,slug,description,price,category_id" +
        (variants ? ",product_variants!inner(id)" : ""),
      { count: "exact" },
    )
    .eq("store_id", storeId)
    .eq("status", "active");
  if (options.categoryId) query = query.eq("category_id", options.categoryId);
  if (options.query)
    query = query.ilike(
      "name",
      "%" + options.query.replace(/[\\%_]/g, "\\$&") + "%",
    );
  if (options.minPrice !== undefined)
    query = query.gte("price", options.minPrice);
  if (options.maxPrice !== undefined)
    query = query.lte("price", options.maxPrice);
  if (options.onSale) query = query.eq("on_sale", true);
  if (options.size)
    query = query.eq("product_variants.options->>size", options.size);
  if (options.color)
    query = query.eq("product_variants.options->>color", options.color);
  if (options.inStock)
    query = query.gt("product_variants.inventory_quantity", 0);
  const sort = options.sort || "newest";
  const [productResult, categoryResult] = await Promise.all([
    query
      .order(
        sort === "name"
          ? "name"
          : sort.startsWith("price")
            ? "price"
            : "created_at",
        { ascending: sort === "name" || sort === "price-asc" },
      )
      .order("id")
      .range(...range),
    client
      .from("categories")
      .select("id,name,slug")
      .eq("store_id", storeId)
      .order("name"),
  ]);
  if (productResult.error || categoryResult.error)
    throw new Error("Не вдалося отримати каталог магазину.");
  const rows = (productResult.data || []) as unknown as Omit<
    CatalogProduct,
    "image" | "imageAlt"
  >[];
  const ids = rows.map((p) => p.id);
  const imageResult = ids.length
    ? await client
        .from("product_images")
        .select("product_id,path,alt")
        .eq("store_id", storeId)
        .in("product_id", ids)
        .order("created_at")
    : { data: [], error: null };
  if (imageResult.error) throw new Error("Не вдалося отримати фото товарів.");
  const firstImages = new Map<string, { path: string; alt: string }>();
  for (const image of imageResult.data || [])
    if (!firstImages.has(image.product_id))
      firstImages.set(image.product_id, image);
  const products: CatalogProduct[] = rows.map((product) => {
    const image = firstImages.get(product.id);
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      category_id: product.category_id,
      price: Number(product.price),
      ...(image
        ? {
            image: client.storage.from("store-media").getPublicUrl(image.path)
              .data.publicUrl,
            imageAlt: image.alt,
          }
        : {}),
    };
  });
  return {
    products,
    count: productResult.count || 0,
    categories: (categoryResult.data || []) as CatalogCategory[],
  };
}
