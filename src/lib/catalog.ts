import "server-only";
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
  } = {},
) {
  const page = options.page || 1;
  const size = options.pageSize || 100;
  let query = client
    .from("products")
    .select("id,name,slug,description,price,category_id", { count: "exact" })
    .eq("store_id", storeId)
    .eq("status", "active");
  if (options.categoryId) query = query.eq("category_id", options.categoryId);
  if (options.query)
    query = query.ilike(
      "name",
      "%" + options.query.replace(/[\\%_]/g, "\\$&") + "%",
    );
  const [productResult, categoryResult] = await Promise.all([
    query
      .order("created_at", { ascending: false })
      .order("id")
      .range((page - 1) * size, page * size - 1),
    client
      .from("categories")
      .select("id,name,slug")
      .eq("store_id", storeId)
      .order("name"),
  ]);
  if (productResult.error || categoryResult.error)
    throw new Error("Не вдалося отримати каталог магазину.");
  const ids = (productResult.data || []).map((p) => p.id);
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
  const products: CatalogProduct[] = (productResult.data || []).map(
    (product) => {
      const image = firstImages.get(product.id);
      return {
        ...product,
        price: Number(product.price),
        ...(image
          ? {
              image: client.storage.from("store-media").getPublicUrl(image.path)
                .data.publicUrl,
              imageAlt: image.alt,
            }
          : {}),
      };
    },
  );
  return {
    products,
    count: productResult.count || 0,
    categories: (categoryResult.data || []) as CatalogCategory[],
  };
}
