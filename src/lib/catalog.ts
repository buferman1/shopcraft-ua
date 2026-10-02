import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogProduct, CatalogCategory } from "./design";

// Only fields intended for a shopper are passed to the storefront renderer.
export async function loadCatalog(client: SupabaseClient, storeId: string) {
  const [productResult, categoryResult, imageResult] = await Promise.all([
    client
      .from("products")
      .select("id,name,slug,description,price,category_id")
      .eq("store_id", storeId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(100),
    client
      .from("categories")
      .select("id,name,slug")
      .eq("store_id", storeId)
      .order("name"),
    client
      .from("product_images")
      .select("product_id,path,alt")
      .eq("store_id", storeId)
      .order("created_at"),
  ]);
  if (productResult.error || categoryResult.error || imageResult.error)
    throw new Error("Не вдалося отримати каталог магазину.");
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
    categories: (categoryResult.data || []) as CatalogCategory[],
  };
}
