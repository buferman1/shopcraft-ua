import { publishedStore } from "@/lib/storefront-data";
import { defaultSettings } from "@/lib/commerce";
import { StorefrontShell } from "@/components/storefront";
import { Cart } from "@/components/cart";
export const dynamic = "force-dynamic";
export default async function CartPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { store, design, supabase } = await publishedStore(slug);
  const { data, error } = await supabase
    .from("store_settings")
    .select(
      "orders_enabled,pickup_enabled,delivery_enabled,shipping_fee,pickup_address,seo_title,seo_description",
    )
    .eq("store_id", store.id)
    .maybeSingle();
  if (error) throw new Error("Не вдалося завантажити налаштування доставки");
  return (
    <main>
      <StorefrontShell store={store} design={design}>
        <Cart
          storeId={store.id}
          slug={slug}
          currency={store.currency}
          settings={
            data
              ? { ...data, shipping_fee: Number(data.shipping_fee) }
              : defaultSettings
          }
        />
      </StorefrontShell>
    </main>
  );
}
