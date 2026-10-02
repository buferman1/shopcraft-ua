import Link from "next/link";
import { storeAccess } from "@/lib/access";
import { canEditCatalog } from "@/lib/validation";
import { ActionForm, Field } from "@/components/action-form";
import { ProductFields } from "@/components/product-fields";
import { saveProduct, createCategory } from "../../actions";
export default async function StorePage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
    sort?: string;
  }>;
}) {
  const { storeId } = await params;
  const { supabase, store, member } = await storeAccess(storeId);
  const search = await searchParams;
  const q = (search.q || "").trim().slice(0, 100);
  const status = ["draft", "active", "archived"].includes(search.status || "")
    ? search.status!
    : "";
  const requestedPage = Number(search.page || 1);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? Math.min(requestedPage, 100000)
      : 1;
  const sort = ["newest", "name", "price"].includes(search.sort || "")
    ? search.sort!
    : "newest";
  let query = supabase
    .from("products")
    .select("id,name,price,status,sku", { count: "exact" })
    .eq("store_id", storeId);
  if (q) query = query.ilike("name", "%" + q.replace(/[\\%_]/g, "\\$&") + "%");
  if (status) query = query.eq("status", status);
  const [
    { data: products, error: pe, count },
    { data: categories, error: ce },
  ] = await Promise.all([
    query
      .order(sort === "newest" ? "created_at" : sort, {
        ascending: sort !== "newest",
      })
      .order("id")
      .range((page - 1) * 25, page * 25 - 1),
    supabase
      .from("categories")
      .select("id,name")
      .eq("store_id", storeId)
      .order("name"),
  ]);
  const pages = Math.max(1, Math.ceil((count || 0) / 25));
  const pageUrl = (number: number) =>
    "?" +
    new URLSearchParams({ q, status, sort, page: String(number) }).toString();
  if (pe || ce) throw new Error("Не вдалося завантажити каталог.");
  const editable = canEditCatalog(member.role) && store.status !== "suspended";
  return (
    <>
      <Link className="text-link" href="/dashboard">
        ← Мої магазини
      </Link>
      <div className="page-head">
        <div>
          <p className="eyebrow">КАТАЛОГ · {store.currency}</p>
          <h1>{store.name}</h1>
          <p className="muted">Керуйте товарами, категоріями та варіантами.</p>
        </div>
        <span className="badge">Роль: {member.role}</span>
      </div>
      <section className="card">
        <h2>Товари</h2>
        <form method="get" className="form-stack">
          <div className="two-col">
            <label className="field">
              Пошук за назвою
              <input name="q" defaultValue={q} maxLength={100} />
            </label>
            <label className="field">
              Статус
              <select name="status" defaultValue={status}>
                <option value="">Усі</option>
                <option value="draft">Чернетки</option>
                <option value="active">Активні</option>
                <option value="archived">Архів</option>
              </select>
            </label>
            <label className="field">
              Сортування
              <select name="sort" defaultValue={sort}>
                <option value="newest">Спочатку нові</option>
                <option value="name">За назвою</option>
                <option value="price">За ціною</option>
              </select>
            </label>
          </div>
          <button className="button secondary">Застосувати</button>
        </form>
        {products?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Товар</th>
                  <th>SKU</th>
                  <th>Ціна</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link
                        className="text-link"
                        href={
                          "/dashboard/stores/" + storeId + "/products/" + p.id
                        }
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td>{p.sku || "—"}</td>
                    <td>
                      {new Intl.NumberFormat("uk-UA", {
                        style: "currency",
                        currency: store.currency,
                      }).format(p.price)}
                    </td>
                    <td>
                      {
                        (
                          {
                            draft: "Чернетка",
                            active: "Активний",
                            archived: "Архів",
                          } as Record<string, string>
                        )[p.status]
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">
            Товарів не знайдено. Змініть фільтри або додайте перший товар.
          </p>
        )}
        <p className="muted">
          Знайдено {count || 0} · Сторінка {page} з {pages}
        </p>
        <nav className="auth-links" aria-label="Сторінки каталогу">
          {page > 1 && <Link href={pageUrl(page - 1)}>← Попередня</Link>}
          {page < pages && <Link href={pageUrl(page + 1)}>Наступна →</Link>}
        </nav>
      </section>
      {editable && (
        <div className="editor-grid">
          <section className="card">
            <h2>Новий товар</h2>
            <ActionForm
              action={saveProduct.bind(null, storeId, null)}
              label="Додати товар"
            >
              <ProductFields categories={categories || []} />
            </ActionForm>
          </section>
          <section className="card">
            <h2>Категорії</h2>
            <ul className="category-list">
              {categories?.map((c) => (
                <li key={c.id}>{c.name}</li>
              ))}
            </ul>
            <ActionForm
              action={createCategory.bind(null, storeId)}
              label="Додати категорію"
            >
              <Field name="name" label="Назва категорії" maxLength={120} />
              <Field name="slug" label="Адреса категорії" maxLength={80} />
            </ActionForm>
          </section>
        </div>
      )}
    </>
  );
}
