import { notFound } from "next/navigation";
import { publishedStore } from "@/lib/storefront-data";
import { slugSchema } from "@/lib/validation";
import { StorefrontShell } from "@/components/storefront";
import {
  StorefrontProduct,
  type PublicVariant,
} from "@/components/storefront-product";

export const dynamic = "force-dynamic";
export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string; productSlug: string }>;
}) {
  const { slug, productSlug } = await params;
  if (!slugSchema.safeParse(productSlug).success) notFound();
  const { supabase, store, design } = await publishedStore(slug);
  const { data: product, error } = await supabase
    .from("products")
    .select("id,name,slug,description,price,category_id")
    .eq("store_id", store.id)
    .eq("slug", productSlug)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error("Не вдалося отримати товар.");
  if (!product) notFound();
  const [images, variants] = await Promise.all([
    supabase
      .from("product_images")
      .select("path,alt")
      .eq("store_id", store.id)
      .eq("product_id", product.id)
      .order("created_at"),
    supabase
      .from("product_variants")
      .select("id,title,price,inventory_quantity,options")
      .eq("store_id", store.id)
      .eq("product_id", product.id)
      .order("created_at"),
  ]);
  if (images.error || variants.error)
    throw new Error("Не вдалося отримати деталі товару.");
  return (
    <main>
      <StorefrontShell design={design} store={store}>
        <a className="sf-back-link" href={`/shop/${slug}#products`}>
          ← До колекції
        </a>
        <StorefrontProduct
          product={{ ...product, price: Number(product.price) }}
          images={(images.data || []).map((image) => ({
            path: supabase.storage.from("store-media").getPublicUrl(image.path)
              .data.publicUrl,
            alt: image.alt || "",
          }))}
          variants={(variants.data || []) as PublicVariant[]}
          currency={store.currency}
        />
      </StorefrontShell>
    </main>
  );
}
