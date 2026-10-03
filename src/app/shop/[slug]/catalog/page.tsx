import Link from "next/link";
import Image from "next/image";
import { publishedStore } from "@/lib/storefront-data";
import { loadCatalog } from "@/lib/catalog";
import { formatPrice } from "@/lib/price";
import { StorefrontShell } from "@/components/storefront";
export const dynamic = "force-dynamic";
export default async function CatalogPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; q?: string; category?: string }>;
}) {
  const { slug } = await params;
  const { store, design, supabase } = await publishedStore(slug);
  const search = await searchParams;
  const requested = Number(search.page || 1);
  const page =
    Number.isInteger(requested) && requested > 0
      ? Math.min(requested, 100000)
      : 1;
  const q = (search.q || "").trim().slice(0, 100);
  const { data: categories, error } = await supabase
    .from("categories")
    .select("id,name,slug")
    .eq("store_id", store.id)
    .order("name");
  if (error) throw new Error("Не вдалося завантажити категорії");
  const category = categories?.find((c) => c.slug === search.category);
  const catalog = await loadCatalog(supabase, store.id, {
    page,
    pageSize: 24,
    query: q,
    categoryId: category?.id,
  });
  const pages = Math.max(1, Math.ceil(catalog.count / 24));
  const link = (p: number) =>
    `/shop/${slug}/catalog?` +
    new URLSearchParams({ page: String(p), q, category: category?.slug || "" });
  return (
    <main>
      <StorefrontShell store={store} design={design}>
        <div className="commerce-panel">
          <h1>Каталог</h1>
          <form method="get" className="design-toolbar-actions">
            <label className="field">
              Пошук
              <input name="q" defaultValue={q} maxLength={100} />
            </label>
            <label className="field">
              Категорія
              <select name="category" defaultValue={category?.slug || ""}>
                <option value="">Усі</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="button">Знайти</button>
          </form>
          <p>Знайдено: {catalog.count}</p>
          <div className="sf-product-grid">
            {catalog.products.map((product) => (
              <Link
                key={product.id}
                className="sf-product-card"
                href={`/shop/${slug}/products/${product.slug}`}
              >
                <div className="sf-product-image">
                  {product.image ? (
                    <Image
                      src={product.image}
                      alt={product.imageAlt || product.name}
                      width={600}
                      height={800}
                      unoptimized
                    />
                  ) : (
                    <span>Фото готується</span>
                  )}
                </div>
                <h2>{product.name}</h2>
                <p>{formatPrice(product.price, store.currency)}</p>
              </Link>
            ))}
          </div>
          {!catalog.products.length && (
            <p>Товарів не знайдено. Змініть пошук або категорію.</p>
          )}
          <nav
            className="design-toolbar-actions"
            aria-label="Сторінки каталогу"
          >
            {page > 1 && (
              <Link className="button secondary" href={link(page - 1)}>
                ← Попередня
              </Link>
            )}
            <p>
              Сторінка {page} з {pages}
            </p>
            {page < pages && (
              <Link className="button secondary" href={link(page + 1)}>
                Наступна →
              </Link>
            )}
          </nav>
        </div>
      </StorefrontShell>
    </main>
  );
}
