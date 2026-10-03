import Link from "next/link";
import { parseCatalogFilters } from "@/lib/catalog-filters";
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
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug } = await params;
  const { store, design, supabase } = await publishedStore(slug);
  const search = await searchParams;
  const filters = parseCatalogFilters(search);
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
    ...filters,
    query: q,
    categoryId: category?.id,
  });
  const pages = Math.max(1, Math.ceil(catalog.count / 24));
  const link = (p: number) =>
    `/shop/${slug}/catalog?` +
    new URLSearchParams({
      page: String(p),
      q,
      category: category?.slug || "",
      min: String(filters.minPrice ?? ""),
      max: String(filters.maxPrice ?? ""),
      size: filters.size,
      color: filters.color,
      stock: filters.inStock ? "1" : "",
      sale: filters.onSale ? "1" : "",
      sort: filters.sort,
    });
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
            <label className="field">
              Ціна від
              <input
                type="number"
                name="min"
                min="0"
                step="0.01"
                defaultValue={filters.minPrice}
              />
            </label>
            <label className="field">
              Ціна до
              <input
                type="number"
                name="max"
                min="0"
                step="0.01"
                defaultValue={filters.maxPrice}
              />
            </label>
            <label className="field">
              Розмір
              <input
                name="size"
                maxLength={30}
                defaultValue={filters.size}
                placeholder="Наприклад, M або 42"
              />
            </label>
            <label className="field">
              Колір
              <input
                name="color"
                maxLength={50}
                defaultValue={filters.color}
                placeholder="Назва кольору"
              />
            </label>
            <label className="field">
              Сортувати
              <select name="sort" defaultValue={filters.sort}>
                <option value="newest">Спочатку новинки</option>
                <option value="price-asc">Від дешевих до дорогих</option>
                <option value="price-desc">Від дорогих до дешевих</option>
                <option value="name">За назвою</option>
              </select>
            </label>
            <label className="design-checkbox">
              <input
                type="checkbox"
                name="stock"
                value="1"
                defaultChecked={filters.inStock}
              />
              У наявності
            </label>
            <label className="design-checkbox">
              <input
                type="checkbox"
                name="sale"
                value="1"
                defaultChecked={filters.onSale}
              />
              Акційна ціна
            </label>
            <button className="button">Знайти</button>
            <Link href={`/shop/${slug}/catalog`} className="text-link">
              Скинути фільтри
            </Link>
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
