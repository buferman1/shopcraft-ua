import type { Metadata } from "next";
import { publishedStore } from "@/lib/storefront-data";
import { loadCatalog } from "@/lib/catalog";
import { Storefront } from "@/components/storefront";

export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { design, supabase, store } = await publishedStore(slug);
  const { data, error } = await supabase
    .from("store_settings")
    .select("seo_title,seo_description")
    .eq("store_id", store.id)
    .maybeSingle();
  if (error) throw new Error("Не вдалося отримати метадані магазину");
  return {
    title: data?.seo_title || `${design.brandName} — колекція`,
    description:
      data?.seo_description ||
      design.sections.find((s) => s.type === "hero")?.text ||
      design.brandName,
  };
}
export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { slug } = await params;
  const { supabase, store, design } = await publishedStore(slug);
  const catalog = await loadCatalog(supabase, store.id);
  const { category } = await searchParams;
  const selected = category
    ? catalog.categories.find((c) => c.slug === category)
    : undefined;
  const products = selected
    ? catalog.products.filter((p) => p.category_id === selected.id)
    : catalog.products;
  return (
    <main>
      <Storefront
        design={design}
        store={store}
        products={products}
        categories={catalog.categories}
      />
      {selected && (
        <div className="sf-filter-note">
          <span>Категорія: {selected.name}</span>
          <a className="text-link" href={`/shop/${slug}#products`}>
            Показати всі товари
          </a>
        </div>
      )}
    </main>
  );
}
